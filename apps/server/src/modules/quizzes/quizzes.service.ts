import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  DEFAULT_TIME_OUT,
  quizSettingsSchema,
  type ImportQuiz,
} from "@buzrr/contract";
import { z } from "zod";
import {
  LlmTimeoutError,
  TextGenerator,
} from "../../common/llm/text-generator";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { EntitlementsService } from "../billing/entitlements.service";
import {
  isDuelEligible,
  QuestionDefinitionError,
  validateDefinition,
} from "../question-types";
import { CreateAiQuizDto } from "./dto/create-ai-quiz.dto";
import {
  AI_QUIZ_JSON_SCHEMA,
  AI_REVIEW_JSON_SCHEMA,
  aiQuizOutputSchema,
  aiReviewOutputSchema,
  applyReview,
  buildAiPrompt,
  buildReviewPrompt,
  dedupe,
  typedTimeOut,
  type AiReviewOutput,
  pickQuestions,
  toDefinitions,
  withSpares,
  type AiDefinition,
  type AiPromptInput,
} from "./ai-quiz";
import {
  AI_TYPES,
  DEFAULT_AI_MIX,
  allocateTypes,
  type AiAmount,
  type AiMix,
  type AiType,
} from "./ai-mix";
import { CreateQuizDto } from "./dto/create-quiz.dto";
import { inAuthoredOrder, OPTION_ORDER } from "../../common/utils/option-order";

/** Review rounds for AI questions: review all, then review the rewrites. */
const AI_REVIEW_ROUNDS = 2;

@Injectable()
export class QuizzesService {
  private readonly logger = new Logger(QuizzesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: TextGenerator,
    private readonly entitlements: EntitlementsService,
  ) {}

  aiAvailable(): boolean {
    return this.llm.configured;
  }

  async create(
    user: AuthUser,
    dto: CreateQuizDto,
  ): Promise<{ quizId: string }> {
    const quiz = await this.prisma.db.$transaction(async (tx) => {
      await this.entitlements.assertQuizCapacity(tx, user.userId);
      return tx.quiz.create({
        data: {
          title: dto.title,
          description: dto.description ?? null,
          userId: user.userId,
        },
      });
    });
    return { quizId: quiz.id };
  }

  /**
   * Copies a quiz the user owns: settings and every question with its
   * options and media (uploads are shared, not copied — they are never
   * deleted while referenced). Duel moderation starts over (draft).
   */
  async duplicate(user: AuthUser, quizId: string): Promise<{ quizId: string }> {
    const source = await this.prisma.db.quiz.findFirst({
      where: { id: quizId, userId: user.userId },
      include: {
        questions: {
          include: { options: { orderBy: OPTION_ORDER } },
          orderBy: { order: "asc" },
        },
      },
    });
    if (!source) {
      throw new NotFoundException("Unauthorized or quiz not found");
    }
    const copy = await this.prisma.db.$transaction(async (tx) => {
      await this.entitlements.assertQuizCapacity(tx, user.userId);
      return tx.quiz.create({
        data: {
          title: `${source.title} (copy)`.slice(0, 200),
          description: source.description,
          userId: user.userId,
          thumbnail: source.thumbnail,
          settings: source.settings ?? {},
          questions: {
            create: source.questions.map((q) => ({
              title: q.title,
              type: q.type,
              config: q.config ?? {},
              createdById: user.userId,
              timeOut: q.timeOut,
              media: q.media,
              mediaType: q.mediaType,
              audio: q.audio,
              audioStartMs: q.audioStartMs,
              audioRevealMs: q.audioRevealMs,
              audioPlayOn: q.audioPlayOn,
              audioClip: q.audioClip,
              audioClipKey: q.audioClipKey,
              audioRevealClip: q.audioRevealClip,
              audioRevealKey: q.audioRevealKey,
              mediaClip: q.mediaClip,
              mediaKey: q.mediaKey,
              order: q.order,
              disabled: q.disabled,
              options: {
                create: inAuthoredOrder(
                  q.options.map((o) => ({
                    title: o.title,
                    isCorrect: o.isCorrect,
                  })),
                ),
              },
            })),
          },
        },
      });
    });
    return { quizId: copy.id };
  }

  async update(
    user: AuthUser,
    quizId: string,
    dto: {
      title?: string;
      description?: string;
      isPublic?: boolean;
      settings?: Record<string, unknown>;
    },
  ) {
    let settings: ReturnType<typeof quizSettingsSchema.parse> | undefined;
    if (dto.settings !== undefined) {
      const parsed = quizSettingsSchema.safeParse(dto.settings);
      if (!parsed.success) {
        throw new BadRequestException("Invalid quiz settings");
      }
      settings = parsed.data;
    }
    const data = {
      ...(settings !== undefined ? { settings } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description.trim() || null }
        : {}),
      ...(dto.isPublic !== undefined ? { isPublic: dto.isPublic } : {}),
    };

    // Nothing to change: verify ownership and return the quiz as-is rather than
    // running an empty transaction/update.
    if (Object.keys(data).length === 0) {
      const existing = await this.prisma.db.quiz.findFirst({
        where: { id: quizId, userId: user.userId },
      });
      if (!existing) {
        throw new NotFoundException("Unauthorized or quiz not found");
      }
      return existing;
    }

    const result = await this.prisma.db.$transaction(async (tx) => {
      const updated = await tx.quiz.updateMany({
        where: { id: quizId, userId: user.userId },
        data,
      });
      // Going public submits never-yet-submitted questions for review;
      // already-decided ones (pending/approved/unapproved) are left alone.
      // Review only feeds the duel pool, so questions duels can't play are
      // set aside as unapproved instead.
      if (updated.count > 0 && dto.isPublic === true) {
        const drafts = await tx.question.findMany({
          where: { quizId, moderationStatus: "draft" },
          select: { id: true, type: true, config: true, options: true },
        });
        const eligible = drafts.filter((q) =>
          isDuelEligible(q.type, { options: q.options, config: q.config }),
        );
        const eligibleIds = new Set(eligible.map((q) => q.id));
        await tx.question.updateMany({
          where: { id: { in: [...eligibleIds] } },
          data: { moderationStatus: "pending" },
        });
        await tx.question.updateMany({
          where: {
            id: {
              in: drafts.filter((q) => !eligibleIds.has(q.id)).map((q) => q.id),
            },
          },
          data: { moderationStatus: "unapproved" },
        });
      }
      return updated;
    });

    if (result.count === 0) {
      throw new NotFoundException("Unauthorized or quiz not found");
    }
    return this.prisma.db.quiz.findUnique({ where: { id: quizId } });
  }

  async delete(user: AuthUser, quizId: string): Promise<void> {
    const result = await this.prisma.db.quiz.deleteMany({
      where: { id: quizId, userId: user.userId },
    });
    if (result.count === 0) {
      throw new NotFoundException("Unauthorized or quiz not found");
    }
  }

  async findAllForUser(user: AuthUser) {
    const quizzes = await this.prisma.db.quiz.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      include: {
        gameSessions: {
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        gameResults: {
          select: { endedAt: true },
          orderBy: { endedAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            questions: { where: { disabled: false } },
            gameResults: true,
          },
        },
      },
    });
    // Newest first by whichever happened last: an edit or a game hosted.
    const activity = (q: (typeof quizzes)[number]) =>
      Math.max(
        q.updatedAt.getTime(),
        q.gameSessions[0]?.createdAt.getTime() ?? 0,
        q.gameResults[0]?.endedAt.getTime() ?? 0,
      );
    return quizzes
      .sort((a, b) => activity(b) - activity(a))
      .map(({ gameSessions: _s, gameResults: _r, ...q }) => q);
  }

  async findOneForUser(user: AuthUser, quizId: string) {
    const quiz = await this.prisma.db.quiz.findFirst({
      where: { id: quizId, userId: user.userId },
      include: {
        gameSessions: {
          orderBy: { createdAt: "desc" },
        },
        gameResults: {
          orderBy: { endedAt: "desc" },
          take: 50,
        },
        _count: { select: { questions: { where: { disabled: false } } } },
      },
    });
    if (!quiz) {
      throw new NotFoundException("Unauthorized or quiz not found");
    }
    return quiz;
  }

  /**
   * Create a quiz from an externally generated question set (Buzrr-AI).
   *
   * Kept on this side of the boundary deliberately: the AI service never writes
   * to `public`, so quiz ownership, question `order` and the `moderationStatus`
   * default all stay in one place. New questions land as `draft` — making the
   * quiz public later moves them to `pending` via `update()`, exactly like
   * hand-authored ones (ADR-007).
   *
   * Each question is checked by its own type's handler, the same check the
   * question editor's endpoint runs.
   */
  async importQuestions(
    user: AuthUser,
    dto: ImportQuiz,
  ): Promise<{ quizId: string; questionCount: number }> {
    const questions = dto.questions.map((question, index) => {
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
    // Imported questions are untagged: only admins categorise (Duel Portal).
    const quiz = await this.prisma.db.$transaction(async (tx) => {
      await this.entitlements.assertQuizCapacity(tx, user.userId);
      return tx.quiz.create({
        data: {
          title: dto.title,
          description: dto.description ?? null,
          userId: user.userId,
          questions: {
            create: questions.map((question, index) => ({
              type: question.type,
              title: question.title,
              timeOut: question.timeOut ?? DEFAULT_TIME_OUT,
              order: index + 1,
              config: question.config,
              createdById: user.userId,
              options: {
                create: inAuthoredOrder(
                  question.options.map((option) => ({
                    title: option.title,
                    isCorrect: option.isCorrect,
                  })),
                ),
              },
            })),
          },
        },
      });
    });

    return { quizId: quiz.id, questionCount: dto.questions.length };
  }

  async createWithAi(
    user: AuthUser,
    dto: CreateAiQuizDto,
  ): Promise<{ msg: string; quizId: string }> {
    if (!this.llm.configured) {
      throw new BadRequestException(
        "AI generation is not configured on this server",
      );
    }

    // Fail fast on a full quiz list before spending an AI token on a quiz that
    // could never be saved. Re-checked inside the insert transaction below.
    await this.prisma.db.$transaction((tx) =>
      this.entitlements.assertQuizCapacity(tx, user.userId),
    );

    const reservation = await this.entitlements.reserveAiToken(
      user.userId,
      "quiz_ai",
    );
    try {
      return await this.generateAndSaveAiQuiz(user, dto);
    } catch (err) {
      // A failed generation must not cost the user a token.
      await this.entitlements
        .releaseAiToken(
          user.userId,
          reservation.reservationId,
          reservation.releaseToken,
        )
        .catch((releaseErr: unknown) =>
          this.logger.error(
            `Failed to refund AI token ${reservation.reservationId}`,
            releaseErr instanceof Error ? releaseErr.stack : String(releaseErr),
          ),
        );
      throw err;
    }
  }

  private async generateAndSaveAiQuiz(
    user: AuthUser,
    dto: CreateAiQuizDto,
  ): Promise<{ msg: string; quizId: string }> {
    const mix: AiMix = {
      multipleChoice: (dto.multipleChoice ??
        DEFAULT_AI_MIX.multipleChoice) as AiAmount,
      trueFalse: (dto.trueFalse ?? DEFAULT_AI_MIX.trueFalse) as AiAmount,
      typeAnswer: (dto.typeAnswer ?? DEFAULT_AI_MIX.typeAnswer) as AiAmount,
    };
    const counts = allocateTypes(dto.questions, mix);
    const prompt = {
      title: dto.title,
      description: dto.description,
      language: dto.language ?? "English",
      time: dto.time,
      difficulty: dto.difficulty ?? 3,
    };

    // Agentic: write (with spares — questions that give their answer away
    // are dropped), then have every question reviewed and the weak ones
    // rewritten, and the rewrites reviewed once more. If that leaves too
    // few, one more round for the rest.
    const defs = await this.generateAiQuestions(dto.title, {
      ...prompt,
      counts: withSpares(counts),
    });
    // A rewrite can repeat another question, so duplicates go after the
    // review too.
    // The quiz's own words (title, description) are no subject of their own.
    const topic = `${dto.title} ${dto.description}`;
    let picked = dedupe(
      await this.reviewAiQuestions(
        prompt,
        pickQuestions(defs, counts, dto.questions, topic),
      ),
      topic,
    );
    if (picked.length < dto.questions) {
      const missing: Record<AiType, number> = {
        multipleChoice: 0,
        trueFalse: 0,
        typeAnswer: 0,
      };
      for (const type of AI_TYPES) {
        const have = picked.filter((d) => d.aiType === type).length;
        missing[type] = Math.max(0, counts[type] - have);
      }
      const total = AI_TYPES.reduce((n, t) => n + missing[t], 0);
      const more = await this.generateAiQuestions(dto.title, {
        ...prompt,
        counts: withSpares(missing),
        avoid: picked.map((d) => d.title),
        avoidAnswers: picked.flatMap((d) =>
          d.aiType === "trueFalse"
            ? []
            : d.options.filter((o) => o.isCorrect).map((o) => o.title),
        ),
      });
      const reviewed = await this.reviewAiQuestions(
        prompt,
        pickQuestions(more, missing, total, topic),
      );
      picked = pickQuestions(
        [...picked, ...reviewed],
        counts,
        dto.questions,
        topic,
      );
    }

    // Each question is checked by its own type's handler, as on import.
    const questions = picked.flatMap((d) => {
      try {
        return [
          {
            ...d,
            ...validateDefinition(d.type, {
              options: d.options,
              config: d.config,
            }),
          },
        ];
      } catch (err) {
        if (err instanceof QuestionDefinitionError) return [];
        throw err;
      }
    });

    if (questions.length < dto.questions) {
      throw new BadRequestException(
        "Couldn't generate enough questions. Try again with different parameters.",
      );
    }

    const quiz = await this.prisma.db.$transaction(async (tx) => {
      await this.entitlements.assertQuizCapacity(tx, user.userId);
      return tx.quiz.create({
        data: {
          title: dto.title,
          description: dto.description,
          userId: user.userId,
          questions: {
            create: questions.map((q, index) => ({
              type: q.type,
              title: q.title,
              config: q.config,
              options: { create: inAuthoredOrder(q.options) },
              // Typing takes longer than a tap.
              timeOut:
                q.type === "type_answer" ? typedTimeOut(dto.time) : dto.time,
              order: index + 1,
              createdById: user.userId,
            })),
          },
        },
      });
    });

    return { msg: "Quiz created successfully", quizId: quiz.id };
  }

  /**
   * Has the model review the questions and rewrite the weak ones, then
   * review the rewrites once more. A review that fails keeps the questions
   * as they are — they already passed the server's own checks.
   */
  private async reviewAiQuestions(
    prompt: Omit<AiPromptInput, "counts" | "avoid">,
    defs: AiDefinition[],
  ): Promise<AiDefinition[]> {
    let current = defs;
    let toReview = defs.map((_, i) => i);
    for (
      let round = 1;
      round <= AI_REVIEW_ROUNDS && toReview.length > 0;
      round++
    ) {
      const subset = toReview.map((i) => current[i]!);
      let review: AiReviewOutput;
      try {
        const raw = await this.llm.generateJson(
          buildReviewPrompt(prompt, subset),
          AI_REVIEW_JSON_SCHEMA,
        );
        review = aiReviewOutputSchema.parse(raw);
      } catch (err) {
        this.logger.warn(
          `AI review round ${round} failed, keeping the questions: ${err instanceof Error ? err.message : String(err)}`,
        );
        break;
      }
      const result = applyReview(prompt.title, subset, review);
      const rewritten = result.revised.filter(Boolean).length;
      const dropped = result.defs.filter((d) => d === null).length;
      this.logger.log(
        `AI review round ${round}: ${subset.length} checked, ${rewritten} rewritten, ${dropped} dropped`,
      );
      // Back into place; the rewrites (still there) get the next round.
      const next: (AiDefinition | null)[] = [...current];
      toReview.forEach((idx, j) => (next[idx] = result.defs[j] ?? null));
      const again = new Set(
        toReview.filter((idx, j) => result.revised[j] && next[idx] !== null),
      );
      const kept: AiDefinition[] = [];
      toReview = [];
      next.forEach((d, i) => {
        if (!d) return;
        if (again.has(i)) toReview.push(kept.length);
        kept.push(d);
      });
      current = kept;
    }
    return current;
  }

  /** One call to the model, as checked question definitions. */
  private async generateAiQuestions(
    quizTitle: string,
    input: AiPromptInput,
  ): Promise<AiDefinition[]> {
    let raw: unknown;
    try {
      raw = await this.llm.generateJson(
        buildAiPrompt(input),
        AI_QUIZ_JSON_SCHEMA,
      );
    } catch (err) {
      this.logger.debug(
        `${this.llm.provider} generation failed: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      if (err instanceof LlmTimeoutError) {
        throw new ServiceUnavailableException(
          "The AI service took too long to respond. Please try again.",
        );
      }
      throw new BadGatewayException(
        "The AI service failed to generate questions. Please try again later.",
      );
    }

    const parsed = aiQuizOutputSchema.safeParse(raw);
    if (!parsed.success) {
      this.logger.debug(
        `${this.llm.provider} returned off-schema output: ${parsed.error.message}`,
      );
      throw new BadGatewayException(
        "The AI service returned an unexpected response. Please try again.",
      );
    }
    return toDefinitions(quizTitle, parsed.data);
  }
}
