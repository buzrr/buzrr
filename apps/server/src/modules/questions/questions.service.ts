import { randomUUID } from "node:crypto";
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
  authoredOptionSchema,
  type AuthoredOption,
  type CreateStandaloneQuestions,
} from "@buzrr/contract";
import {
  MediaStorage,
  MediaUnavailableError,
  UnsupportedMediaError,
} from "../../common/storage/media-storage";
import { toMp3 } from "../../common/storage/audio-transcode";
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
    audioFile?: Express.Multer.File,
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
    // Categories are admin-only (Duel Portal); an edit keeps whatever
    // categories an admin set, and a `categoryIds` field here is ignored.
    const { options, config } = definition;

    // Ownership first: the old media we may delete below is the edited
    // question's own, read from the database.
    let existing: { media: string | null; audio: string | null } | null = null;
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

    const store = async (
      upload: Express.Multer.File,
      kind: "image" | "audio",
    ) => {
      try {
        const buffer =
          kind === "audio" ? await toMp3(upload.buffer) : upload.buffer;
        return await this.storage.upload(buffer, {
          contentType: upload.mimetype,
          filename: upload.originalname,
          kind,
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
    };

    // Sound: a new upload replaces it, `audio_link` keeps a URL (normally the
    // stored one), neither means the question has none.
    let audio: string | null = null;
    if (audioFile && audioFile.size > 0) {
      audio = (await store(audioFile, "audio")).url;
    } else if (body.audio_link && /^https?:\/\//.test(body.audio_link)) {
      audio = body.audio_link;
    }
    const cueMs = (raw: string | undefined) => {
      const n = parseInt(raw ?? "", 10);
      return Number.isFinite(n) && n >= 0 ? Math.min(n, 86_400_000) : null;
    };
    const audioFields = {
      audio,
      audioStartMs: audio ? (cueMs(body.audio_start_ms) ?? 0) : null,
      audioRevealMs: audio ? cueMs(body.audio_reveal_ms) : null,
      // null = like the quiz's sound setting
      audioPlayOn:
        audio &&
        ["host", "players", "both", "off"].includes(body.audio_play_on ?? "")
          ? body.audio_play_on!
          : null,
    };

    if (file && file.size > 0) {
      const uploaded = await store(file, "image");
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
            ...audioFields,
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
      if (existing?.audio && existing.audio !== audio) {
        await this.storage.remove(existing.audio);
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
            ...audioFields,
            order: count + 1,
            moderationStatus,
            createdById: user.userId,
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

    // Three bulk inserts in one batch transaction rather than a nested create
    // per question: up to 500 sequential nested creates over a remote link
    // outlived the interactive-transaction timeout, whose mid-write rollback
    // surfaced as a foreign key error on the children.
    const rows = questions.map((question) => ({
      ...question,
      id: randomUUID(),
    }));
    // Options are read back ordered by createdAt; distinct timestamps keep
    // the authored order.
    const base = Date.now();
    await this.prisma.db.$transaction([
      this.prisma.db.question.createMany({
        data: rows.map((question) => ({
          id: question.id,
          type: question.type,
          title: question.title,
          config: question.config,
          timeOut: question.timeOut ?? DEFAULT_TIME_OUT,
          createdById: user.userId,
          moderationStatus: isDuelEligible(question.type, question)
            ? "pending"
            : "unapproved",
        })),
      }),
      this.prisma.db.option.createMany({
        data: rows.flatMap((question) =>
          question.options.map((option, index) => ({
            questionId: question.id,
            title: option.title,
            isCorrect: option.isCorrect,
            createdAt: new Date(base + index),
          })),
        ),
      }),
      this.prisma.db.questionCategory.createMany({
        data: rows.flatMap((question) =>
          [...new Set(question.categoryIds ?? [])].map((categoryId) => ({
            questionId: question.id,
            categoryId,
          })),
        ),
      }),
    ]);
    const ids = rows.map((question) => question.id);
    return { created: ids.length, ids };
  }
}
