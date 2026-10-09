import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { DEFAULT_TIME_OUT, type ImportQuiz } from "@buzrr/contract";
import { z } from "zod";
import {
  LlmTimeoutError,
  TextGenerator,
} from "../../common/llm/text-generator";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { EntitlementsService } from "../billing/entitlements.service";
import { QuestionDefinitionError, validateDefinition } from "../question-types";
import { CreateAiQuizDto } from "./dto/create-ai-quiz.dto";
import { CreateQuizDto } from "./dto/create-quiz.dto";

/**
 * Shape the model must return (sent to the provider as a JSON Schema for
 * structured output, then used to validate the reply). Correct and wrong
 * answers are separate fields so there is no positional convention to get
 * wrong; options are shuffled before saving.
 */
const aiQuizOutputSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe("The question, one concise sentence."),
      correctAnswer: z
        .string()
        .describe("The single correct option. Short: ideally 1-5 words."),
      wrongAnswers: z
        .array(z.string())
        .length(3)
        .describe(
          "Exactly three plausible but wrong options, each about as short as the correct one.",
        ),
    }),
  ),
});

// `$schema` is dropped: strict structured-output modes reject unknown keys.
const { $schema: _draft, ...aiQuizJsonSchema } =
  z.toJSONSchema(aiQuizOutputSchema);
const AI_QUIZ_JSON_SCHEMA = {
  name: "quiz_questions",
  schema: aiQuizJsonSchema,
};

type AiQuestion = z.infer<typeof aiQuizOutputSchema>["questions"][number];

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
}

/** Trims every field; null if anything ended up blank or options repeat. */
function toOptions(q: AiQuestion) {
  const question = q.question.trim();
  const answers = [q.correctAnswer, ...q.wrongAnswers].map((a) => a.trim());
  const distinct = new Set(answers.map((a) => a.toLowerCase()));
  if (!question || answers.some((a) => !a) || distinct.size !== answers.length)
    return null;
  const options = answers.map((title, i) => ({ title, isCorrect: i === 0 }));
  shuffleArray(options);
  return { question, options };
}

@Injectable()
export class QuizzesService {
  private readonly logger = new Logger(QuizzesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: TextGenerator,
    private readonly entitlements: EntitlementsService,
  ) {}

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

  async update(
    user: AuthUser,
    quizId: string,
    dto: { title?: string; description?: string; isPublic?: boolean },
  ) {
    const data = {
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
      if (updated.count > 0 && dto.isPublic === true) {
        await tx.question.updateMany({
          where: { quizId, moderationStatus: "draft" },
          data: { moderationStatus: "pending" },
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
    return this.prisma.db.quiz.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { questions: true, gameResults: true } },
      },
    });
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
        _count: { select: { questions: true } },
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
              options: {
                create: question.options.map((option) => ({
                  title: option.title,
                  isCorrect: option.isCorrect,
                })),
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
    const prompt = `You are writing questions for a live, timed multiple-choice quiz game. Players read each question and its four options on their phones and have ${dto.time} seconds to answer.

Quiz topic, as described by the host:
"""
${dto.description}
"""

Write exactly ${dto.questions} questions on that topic.

Rules:
- Each question has exactly one correct answer and three plausible but clearly wrong answers.
- Keep answer options SHORT so players can read all four within a few seconds: ideally 1-5 words, never more than about 60 characters. Put any needed context in the question, not in the options.
- Keep each question concise: one sentence where possible, under about 150 characters.
- Make the four options of a question similar in length and style so the correct one doesn't stand out.
- Options are shuffled, so never use "All of the above", "None of the above" or answers that refer to other options.
- Don't repeat questions.`;

    let raw: unknown;
    try {
      raw = await this.llm.generateJson(prompt, AI_QUIZ_JSON_SCHEMA);
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
    const questionsArray = parsed.data.questions
      .map(toOptions)
      .filter((q) => q !== null);

    if (questionsArray.length < dto.questions) {
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
            create: questionsArray.slice(0, dto.questions).map((q, index) => ({
              title: q.question,
              options: { create: q.options },
              timeOut: dto.time,
              order: index + 1,
            })),
          },
        },
      });
    });

    return { msg: "Quiz created successfully", quizId: quiz.id };
  }
}
