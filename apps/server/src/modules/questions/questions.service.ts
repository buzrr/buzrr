import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DEFAULT_QUESTION_TYPE,
  DEFAULT_TIME_OUT,
  authoredOptionSchema,
  type AuthoredOption,
} from "@buzrr/contract";
import {
  MediaStorage,
  UnsupportedMediaError,
} from "../../common/storage/media-storage";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { QuestionDefinitionError, validateDefinition } from "../question-types";
import { ReorderQuestionsDto } from "./dto/reorder-questions.dto";

type MultipartBody = Record<string, string | undefined>;

function parseJsonField(raw: string | undefined, field: string): unknown {
  if (raw === undefined || raw.trim() === "") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new BadRequestException(`${field} must be valid JSON`);
  }
}

/**
 * Options from a multipart body: either `options` (a JSON array of
 * `{ title, isCorrect }`, any type) or the original four-option form fields
 * (`option1`–`option4` + `choose_option` a–d) the multiple-choice editor
 * still sends.
 */
function optionsFromMultipart(body: MultipartBody): AuthoredOption[] {
  const json = parseJsonField(body.options, "options");
  if (json !== undefined) {
    const parsed = authoredOptionSchema.array().safeParse(json);
    if (!parsed.success) {
      throw new BadRequestException("options must be [{ title, isCorrect }]");
    }
    return parsed.data;
  }

  const titles = [body.option1, body.option2, body.option3, body.option4];
  const correctKey = body.choose_option?.trim().toLowerCase();
  if (titles.some((t) => !t) || !correctKey) {
    throw new BadRequestException("Missing required fields");
  }
  const keys = ["a", "b", "c", "d"];
  if (!keys.includes(correctKey)) {
    throw new BadRequestException("choose_option must be a, b, c, or d");
  }
  return titles.map((title, i) => ({
    title: title ?? "",
    isCorrect: keys[i] === correctKey,
  }));
}

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorage,
  ) {}

  private async assertQuizOwned(quizId: string, userId: string) {
    const quiz = await this.prisma.db.quiz.findFirst({
      where: { id: quizId, userId },
    });
    if (!quiz) {
      throw new NotFoundException("Unauthorized or quiz not found");
    }
    return quiz;
  }

  async findAllForQuiz(user: AuthUser, quizId: string) {
    await this.assertQuizOwned(quizId, user.userId);
    const questions = await this.prisma.db.question.findMany({
      where: { quizId },
      include: { options: true },
      orderBy: { order: "asc" },
    });
    return { status: 200, questions };
  }

  async reorder(user: AuthUser, dto: ReorderQuestionsDto) {
    const dragQues = await this.prisma.db.question.findUnique({
      where: { id: dto.dragQuesId },
      include: { quiz: true },
    });
    const dropQues = await this.prisma.db.question.findUnique({
      where: { id: dto.dropQuesId },
      include: { quiz: true },
    });
    if (!dragQues || !dropQues) {
      throw new NotFoundException("Question not found");
    }
    if (
      dragQues.quizId !== dropQues.quizId ||
      dragQues.quiz.userId !== user.userId
    ) {
      throw new ForbiddenException("Unauthorized");
    }

    const dragOrder = dragQues.order;
    const dropOrder = dropQues.order;
    if (dragOrder === dropOrder) {
      return { status: 200, message: "Success" };
    }

    // Insert-at-position semantics: the dragged question takes the drop
    // slot and everything between shifts by one.
    const quizId = dragQues.quizId;
    await this.prisma.db.$transaction([
      dragOrder < dropOrder
        ? this.prisma.db.question.updateMany({
            where: { quizId, order: { gt: dragOrder, lte: dropOrder } },
            data: { order: { decrement: 1 } },
          })
        : this.prisma.db.question.updateMany({
            where: { quizId, order: { gte: dropOrder, lt: dragOrder } },
            data: { order: { increment: 1 } },
          }),
      this.prisma.db.question.update({
        where: { id: dto.dragQuesId },
        data: { order: dropOrder },
      }),
    ]);

    return { status: 200, message: "Success" };
  }

  async delete(user: AuthUser, quesId: string): Promise<void> {
    const question = await this.prisma.db.question.findUnique({
      where: { id: quesId },
      include: { quiz: true },
    });
    if (!question) {
      throw new NotFoundException("Question not found");
    }
    if (question.quiz.userId !== user.userId) {
      throw new ForbiddenException("Unauthorized");
    }
    const deletedOrder = question.order;
    const quizId = question.quizId;
    await this.prisma.db.$transaction([
      this.prisma.db.question.delete({ where: { id: quesId } }),
      this.prisma.db.question.updateMany({
        where: { quizId, order: { gt: deletedOrder } },
        data: { order: { decrement: 1 } },
      }),
    ]);
  }

  async upsertFromMultipart(
    user: AuthUser,
    quizId: string,
    body: MultipartBody,
    file: Express.Multer.File | undefined,
  ): Promise<void> {
    const quiz = await this.assertQuizOwned(quizId, user.userId);

    const title = body.title?.trim();
    const time = body.time;
    const quesId = body.ques_id?.trim() || undefined;
    const file_link = body.file_link;
    const file_type = body.media_type;
    const type = body.type?.trim() || DEFAULT_QUESTION_TYPE;

    if (!title) {
      throw new BadRequestException("Missing required fields");
    }

    // The question's type owns what valid content looks like.
    let definition;
    try {
      definition = validateDefinition(type, {
        options: optionsFromMultipart(body),
        config: parseJsonField(body.config, "config") ?? {},
      });
    } catch (err) {
      if (err instanceof QuestionDefinitionError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
    const { options, config } = definition;

    // Ownership first: the old media we may delete below is the edited
    // question's own, read from the database.
    let existing: { media: string | null } | null = null;
    if (quesId) {
      const question = await this.prisma.db.question.findUnique({
        where: { id: quesId },
        include: { quiz: true },
      });
      if (!question || question.quiz.userId !== user.userId) {
        throw new ForbiddenException("Unauthorized");
      }
      existing = question;
    }

    let fileLink = "";
    let mediaType = "";

    if (file && file.size > 0) {
      let uploaded;
      try {
        uploaded = await this.storage.upload(file.buffer, {
          contentType: file.mimetype,
          filename: file.originalname,
        });
      } catch (err) {
        if (err instanceof UnsupportedMediaError) {
          throw new BadRequestException(err.message);
        }
        throw err;
      }
      fileLink = uploaded.url;
      mediaType = uploaded.mediaType;
    } else if (file_link) {
      fileLink = file_link;
      mediaType = file_type ?? "";
    }

    const timeOut = parseInt(time ?? "", 10) || DEFAULT_TIME_OUT;
    // Any create/edit re-enters the moderation queue if the quiz is public --
    // approved content doesn't stay approved across an edit, since the
    // reviewed text may have changed.
    const moderationStatus = quiz.isPublic ? "pending" : "draft";

    if (quesId) {
      await this.prisma.db.$transaction(async (tx) => {
        await tx.question.update({
          where: { id: quesId },
          data: {
            title,
            type,
            config,
            quizId,
            timeOut,
            media: fileLink || null,
            mediaType: mediaType || null,
            moderationStatus,
            reportCount: 0,
          },
        });
        await tx.option.deleteMany({ where: { questionId: quesId } });
        await tx.option.createMany({
          data: options.map((o) => ({
            title: o.title,
            isCorrect: o.isCorrect,
            questionId: quesId,
          })),
        });
        await tx.questionReport.deleteMany({ where: { questionId: quesId } });
      });
      // Only now, and only the question's own stored media — never a URL
      // the client sent (`file_link`), which could name anyone's upload.
      if (existing?.media && existing.media !== fileLink) {
        await this.storage.remove(existing.media);
      }
    } else {
      await this.prisma.db.$transaction(async (tx) => {
        const count = await tx.question.count({ where: { quizId } });
        await tx.question.create({
          data: {
            title,
            type,
            config,
            options: { create: options },
            quizId,
            timeOut,
            media: fileLink || null,
            mediaType: mediaType || null,
            order: count + 1,
            moderationStatus,
          },
        });
      });
    }
  }
}
