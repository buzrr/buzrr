import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  DEFAULT_QUESTION_TYPE,
  DEFAULT_TIME_OUT,
  MAX_QUESTION_CATEGORIES,
  authoredOptionSchema,
  type AuthoredOption,
  type CreateStandaloneQuestions,
} from "@buzrr/contract";
import {
  MediaStorage,
  MediaUnavailableError,
  UnsupportedMediaError,
} from "../../common/storage/media-storage";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import {
  isDuelEligible,
  QuestionDefinitionError,
  validateDefinition,
} from "../question-types";
import { CategoriesService } from "../categories/categories.service";
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

/** `categoryIds` from a multipart body: a JSON string array, or absent. */
function categoryIdsFromMultipart(body: MultipartBody): string[] | undefined {
  const json = parseJsonField(body.categoryIds, "categoryIds");
  if (json === undefined) return undefined;
  if (
    !Array.isArray(json) ||
    json.length > MAX_QUESTION_CATEGORIES ||
    json.some((id) => typeof id !== "string" || id.length === 0)
  ) {
    throw new BadRequestException(
      `categoryIds must be up to ${MAX_QUESTION_CATEGORIES} category ids`,
    );
  }
  return json as string[];
}

/**
 * Who may edit or delete a question: its author, or the owner of the quiz it
 * belongs to.
 */
function ownsQuestion(
  question: { createdById: string | null; quiz: { userId: string } | null },
  userId: string,
): boolean {
  return question.createdById === userId || question.quiz?.userId === userId;
}

@Injectable()
export class QuestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorage,
    private readonly categories: CategoriesService,
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
      include: {
        options: true,
        categories: { select: { categoryId: true } },
      },
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
      !dragQues.quiz ||
      dragQues.quizId !== dropQues.quizId ||
      dragQues.quiz.userId !== user.userId
    ) {
      // Standalone questions have no order to change.
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
    if (!ownsQuestion(question, user.userId)) {
      throw new ForbiddenException("Unauthorized");
    }
    const deletedOrder = question.order;
    const quizId = question.quizId;
    if (!quizId) {
      await this.prisma.db.question.delete({ where: { id: quesId } });
      return;
    }
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
    // Undefined leaves an edited question's categories untouched.
    const rawCategoryIds = categoryIdsFromMultipart(body);
    const categoryIds =
      rawCategoryIds === undefined
        ? undefined
        : await this.categories.assertExist(rawCategoryIds);

    // Ownership first: the old media we may delete below is the edited
    // question's own, read from the database.
    let existing: { media: string | null } | null = null;
    if (quesId) {
      const question = await this.prisma.db.question.findUnique({
        where: { id: quesId },
        include: { quiz: true },
      });
      // Edits stay in the quiz named by the URL: no moving a question to
      // another quiz, or pulling a standalone one into a quiz.
      if (
        !question ||
        question.quizId !== quizId ||
        !ownsQuestion(question, user.userId)
      ) {
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
        if (err instanceof MediaUnavailableError) {
          throw new ServiceUnavailableException(err.message);
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
    // reviewed text may have changed. Moderation only feeds the duel pool, so
    // content duels can't play (polls, multi-answer questions, …) skips the
    // queue and stays out of it.
    const moderationStatus = !quiz.isPublic
      ? "draft"
      : isDuelEligible(type, definition)
        ? "pending"
        : "unapproved";

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
        if (categoryIds !== undefined) {
          await tx.questionCategory.deleteMany({
            where: { questionId: quesId },
          });
          await tx.questionCategory.createMany({
            data: categoryIds.map((categoryId) => ({
              questionId: quesId,
              categoryId,
            })),
          });
        }
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
            createdById: user.userId,
            categories: {
              create: (categoryIds ?? []).map((categoryId) => ({
                categoryId,
              })),
            },
          },
        });
      });
    }
  }

  /**
   * Standalone questions (no quiz) — duel-pool content, e.g. a bulk upload.
   * They skip the quiz-only `draft` state and go straight to moderation;
   * content duels can't play is parked as `unapproved`.
   */
  async createStandalone(
    user: AuthUser,
    body: CreateStandaloneQuestions,
  ): Promise<{ created: number; ids: string[] }> {
    const questions = body.questions.map((question, index) => {
      try {
        const definition = validateDefinition(question.type, {
          options: question.options,
          config: question.config,
        });
        return { ...question, ...definition };
      } catch (err) {
        if (err instanceof QuestionDefinitionError) {
          throw new BadRequestException(
            `Question ${index + 1}: ${err.message}`,
          );
        }
        throw err;
      }
    });
    await this.categories.assertExist(
      questions.flatMap((q) => q.categoryIds ?? []),
    );

    const ids = await this.prisma.db.$transaction(async (tx) => {
      const created: string[] = [];
      for (const question of questions) {
        const row = await tx.question.create({
          data: {
            type: question.type,
            title: question.title,
            config: question.config,
            timeOut: question.timeOut ?? DEFAULT_TIME_OUT,
            createdById: user.userId,
            moderationStatus: isDuelEligible(question.type, question)
              ? "pending"
              : "unapproved",
            options: {
              create: question.options.map((option) => ({
                title: option.title,
                isCorrect: option.isCorrect,
              })),
            },
            categories: {
              create: [...new Set(question.categoryIds ?? [])].map(
                (categoryId) => ({ categoryId }),
              ),
            },
          },
          select: { id: true },
        });
        created.push(row.id);
      }
      return created;
    });
    return { created: ids.length, ids };
  }
}
