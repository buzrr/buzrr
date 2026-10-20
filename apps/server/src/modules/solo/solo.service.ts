import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  QuestionAnswer,
  QuestionStats,
  SoloTestInfo,
  SoloTestItem,
  SoloTestReport,
  SoloView,
} from "@buzrr/contract";
import { Prisma } from "@buzrr/prisma";
import { customAlphabet } from "nanoid";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { resolveGameLook } from "../../common/game-look/game-look";
import { OPTION_ORDER } from "../../common/utils/option-order";
import { PrismaService } from "../../prisma/prisma.service";
import { EntitlementsService } from "../billing/entitlements.service";
import {
  questionStats,
  toLiveQuestion,
  toPublicQuestion,
  type LiveQuestion,
} from "../question-types";
import { ANSWER_GRACE_MS } from "../../common/utils/answer-timing";
import { CreateSoloTestDto } from "./dto/create-solo-test.dto";
import { UpdateSoloTestDto } from "./dto/update-solo-test.dto";
import {
  judgeSoloAnswer,
  missedRow,
  soloDeadline,
  soloRank,
  soloReveal,
  type SoloAnswerRow,
} from "./solo-core";

const generateCode = customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 8);

type TestRow = Prisma.SoloTestGetPayload<{
  include: { host: { select: { name: true; image: true } } };
}>;
type AttemptRow = Prisma.SoloAttemptGetPayload<{ include: { answers: true } }>;

const questionsOf = (test: { questions: Prisma.JsonValue }) =>
  test.questions as unknown as LiveQuestion[];

const isClosed = (test: { closesAt: Date | null }, now = Date.now()) =>
  test.closesAt !== null && test.closesAt.getTime() <= now;

const rowOf = (a: AttemptRow["answers"][number]): SoloAnswerRow => ({
  qIndex: a.qIndex,
  answer: a.answer as QuestionAnswer | null,
  timeTakenMs: a.timeTakenMs,
  isCorrect: a.isCorrect,
  score: a.score,
});

/**
 * "Play alone" (ADR-016): tests a host shares as a link, played by each
 * player at their own pace. Plain REST on Postgres — no room, no Redis —
 * with the live game's question handlers, timing and scoring.
 */
@Injectable()
export class SoloService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  // -- host ---------------------------------------------------------------------

  async create(user: AuthUser, dto: CreateSoloTestDto): Promise<SoloTestItem> {
    const quiz = await this.prisma.db.quiz.findFirst({
      where: { id: dto.quizId, userId: user.userId },
      include: {
        questions: {
          // Disabled questions are skipped, as in a live game.
          where: { disabled: false },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
          include: { options: { orderBy: OPTION_ORDER } },
        },
      },
    });
    if (!quiz) throw new NotFoundException("Unauthorized or quiz not found");
    const questions = quiz.questions
      .map((q) => toLiveQuestion(q))
      .filter((q): q is LiveQuestion => q !== null);
    if (questions.length === 0) {
      throw new BadRequestException("The quiz has no playable questions");
    }
    const closesAt = dto.closesAt ? new Date(dto.closesAt) : null;
    if (closesAt && closesAt.getTime() <= Date.now()) {
      throw new BadRequestException("The deadline must be in the future");
    }

    // Practising again replaces the previous practice run of this quiz.
    if (dto.practice) {
      await this.prisma.db.soloTest.deleteMany({
        where: { hostId: user.userId, quizId: quiz.id, practice: true },
      });
    }
    for (let i = 0; i < 5; i++) {
      try {
        const test = await this.prisma.db.soloTest.create({
          data: {
            code: generateCode(),
            hostId: user.userId,
            quizId: quiz.id,
            title: quiz.title,
            questions: questions as unknown as Prisma.InputJsonValue,
            practice: dto.practice ?? false,
            closesAt,
          },
        });
        return this.item(test, 0, 0);
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          continue;
        }
        throw e;
      }
    }
    throw new ConflictException("Could not create a test code, try again");
  }

  /** The host's tests (newest first), optionally of one quiz. */
  async list(user: AuthUser, quizId?: string): Promise<SoloTestItem[]> {
    const tests = await this.prisma.db.soloTest.findMany({
      where: {
        hostId: user.userId,
        practice: false,
        ...(quizId ? { quizId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const counts = await this.prisma.db.soloAttempt.groupBy({
      by: ["testId"],
      where: { testId: { in: tests.map((t) => t.id) } },
      _count: { _all: true, finishedAt: true },
    });
    const byId = new Map(counts.map((c) => [c.testId, c._count]));
    return tests.map((t) =>
      this.item(t, byId.get(t.id)?._all ?? 0, byId.get(t.id)?.finishedAt ?? 0),
    );
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateSoloTestDto,
  ): Promise<SoloTestItem> {
    await this.ownTest(user, id);
    const closesAt =
      dto.closesAt === "now"
        ? new Date()
        : dto.closesAt
          ? new Date(dto.closesAt)
          : null;
    const test = await this.prisma.db.soloTest.update({
      where: { id },
      data: { closesAt },
    });
    const [started, finished] = await Promise.all([
      this.prisma.db.soloAttempt.count({ where: { testId: id } }),
      this.prisma.db.soloAttempt.count({
        where: { testId: id, finishedAt: { not: null } },
      }),
    ]);
    return this.item(test, started, finished);
  }

  async remove(user: AuthUser, id: string): Promise<{ deleted: true }> {
    await this.ownTest(user, id);
    await this.prisma.db.soloTest.delete({ where: { id } });
    return { deleted: true };
  }

  /** Standings and how each question went, as far as players have got. */
  async report(user: AuthUser, id: string): Promise<SoloTestReport> {
    const test = await this.ownTest(user, id);
    const attempts = await this.prisma.db.soloAttempt.findMany({
      where: { testId: id },
      include: { answers: true },
      orderBy: [{ score: "desc" }, { startedAt: "asc" }],
    });
    const scores = attempts.map((a) => a.score);
    const questions = questionsOf(test);
    const stats: QuestionStats[] = questions.map((q, i) => {
      const rows = attempts
        .flatMap((a) => a.answers)
        .filter((r) => r.qIndex === i && r.answer !== null)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      return questionStats(
        q,
        i,
        rows.map((r) => ({
          answer: r.answer as QuestionAnswer,
          author: null,
        })),
        rows.map((r) => r.timeTakenMs),
      );
    });
    return {
      test: this.item(
        test,
        attempts.length,
        attempts.filter((a) => a.finishedAt).length,
      ),
      entries: attempts.map((a) => ({
        rank: soloRank(a.score, scores),
        name: a.playerName,
        profilePic: a.profilePic,
        score: a.score,
        correctCount: a.correctCount,
        finished: a.finishedAt !== null,
        progress: a.answers.length,
      })),
      questions: stats,
    };
  }

  // -- player -------------------------------------------------------------------

  async info(code: string): Promise<SoloTestInfo> {
    const test = await this.testByCode(code);
    // The quiz's sounds as they are now, with the host's defaults filled in
    // (a deleted quiz: the defaults).
    const [quiz, host, plan] = await Promise.all([
      test.quizId
        ? this.prisma.db.quiz.findUnique({
            where: { id: test.quizId },
            select: { settings: true },
          })
        : null,
      this.prisma.db.user.findUnique({
        where: { id: test.hostId },
        select: { preferences: true },
      }),
      this.entitlements.resolvePlan(test.hostId),
    ]);
    const look = resolveGameLook(
      { settings: quiz?.settings ?? {}, logo: null },
      host?.preferences,
      plan === "pro",
    );
    return {
      code: test.code,
      title: test.title,
      questionCount: questionsOf(test).length,
      hostName: test.host.name,
      hostImage: test.host.image,
      closesAt: test.closesAt?.toISOString() ?? null,
      closed: isClosed(test),
      sound: look.settings.sound,
    };
  }

  /** Starts this player's attempt, or picks it up where they left it. */
  async start(playerId: string, code: string): Promise<SoloView> {
    const test = await this.testByCode(code);
    let attempt = await this.prisma.db.soloAttempt.findUnique({
      where: { testId_playerId: { testId: test.id, playerId } },
      include: { answers: true },
    });
    if (!attempt) {
      if (isClosed(test)) throw new ForbiddenException("This test is closed");
      const player = await this.prisma.db.player.findUnique({
        where: { id: playerId },
      });
      if (!player) throw new NotFoundException("Player not found");
      attempt = await this.prisma.db.soloAttempt.upsert({
        where: { testId_playerId: { testId: test.id, playerId } },
        create: {
          testId: test.id,
          playerId,
          playerName: player.name,
          profilePic: player.profilePic,
        },
        update: {},
        include: { answers: true },
      });
    }
    return this.view(test, attempt);
  }

  /** Opens the next question (or finishes after the last). */
  async next(playerId: string, attemptId: string): Promise<SoloView> {
    const { test, attempt } = await this.ownAttempt(playerId, attemptId);
    const current = await this.view(test, attempt);
    if (current.phase !== "intro" && current.phase !== "reveal") return current;
    if (isClosed(test)) throw new ForbiddenException("This test is closed");

    const next = attempt.qIndex + 1;
    const done = next >= questionsOf(test).length;
    // Conditional on the question it moves from, so a double tap can't skip.
    await this.prisma.db.soloAttempt.updateMany({
      where: { id: attempt.id, qIndex: attempt.qIndex },
      data: done
        ? { finishedAt: new Date() }
        : { qIndex: next, qStartAt: new Date() },
    });
    return this.view(test, await this.reload(attempt.id));
  }

  async answer(
    playerId: string,
    attemptId: string,
    qIndex: number,
    raw: unknown,
  ): Promise<SoloView> {
    const { test, attempt } = await this.ownAttempt(playerId, attemptId);
    if (attempt.finishedAt || attempt.qIndex !== qIndex || !attempt.qStartAt) {
      throw new ConflictException("This question is no longer open");
    }
    if (attempt.answers.some((a) => a.qIndex === qIndex)) {
      return this.view(test, attempt);
    }
    if (isClosed(test)) throw new ForbiddenException("This test is closed");
    const question = questionsOf(test)[qIndex];
    if (!question) throw new NotFoundException("Question not found");

    const judged = judgeSoloAnswer(
      question,
      qIndex,
      attempt.qStartAt.getTime(),
      raw,
      Date.now(),
    );
    if (judged.kind === "invalid") {
      throw new BadRequestException("Invalid answer");
    }
    await this.store(attempt.id, judged.row);
    return this.view(test, await this.reload(attempt.id));
  }

  // -- helpers ------------------------------------------------------------------

  /**
   * The attempt as its screen shows it. A question whose time ran out
   * unanswered is stored as missed first, so a player who closed the tab
   * comes back to its result, not to more time.
   */
  private async view(test: TestRow, attempt: AttemptRow): Promise<SoloView> {
    const questions = questionsOf(test);
    const qCount = questions.length;
    const base = {
      attemptId: attempt.id,
      qIndex: Math.max(0, attempt.qIndex),
      qCount,
      totalScore: attempt.score,
      correctCount: attempt.correctCount,
    };
    if (attempt.finishedAt) {
      const finished = await this.prisma.db.soloAttempt.findMany({
        where: { testId: test.id, finishedAt: { not: null } },
        select: { score: true },
      });
      const scores = finished.map((f) => f.score);
      return {
        ...base,
        phase: "done",
        final: { rank: soloRank(attempt.score, scores), of: scores.length },
      };
    }
    const question = questions[attempt.qIndex];
    if (attempt.qIndex < 0 || !question || !attempt.qStartAt) {
      return { ...base, phase: "intro" };
    }

    let answered = attempt.answers.find((a) => a.qIndex === attempt.qIndex);
    const deadline = soloDeadline(question, attempt.qStartAt.getTime());
    if (!answered && Date.now() > deadline + ANSWER_GRACE_MS) {
      await this.store(attempt.id, missedRow(question, attempt.qIndex));
      attempt = await this.reload(attempt.id);
      answered = attempt.answers.find((a) => a.qIndex === attempt.qIndex);
    }
    if (answered) {
      return {
        ...base,
        totalScore: attempt.score,
        correctCount: attempt.correctCount,
        phase: "reveal",
        question: toPublicQuestion(question),
        ...soloReveal(question, rowOf(answered), attempt.score),
      };
    }
    return {
      ...base,
      phase: "question",
      question: toPublicQuestion(question),
      remainingMs: Math.max(0, deadline - Date.now()),
    };
  }

  /** Stores an answer and adds its points (once: the unique index wins). */
  private async store(attemptId: string, row: SoloAnswerRow): Promise<void> {
    try {
      await this.prisma.db.$transaction([
        this.prisma.db.soloAnswer.create({
          data: {
            attemptId,
            qIndex: row.qIndex,
            answer:
              row.answer === null
                ? Prisma.DbNull
                : (row.answer as unknown as Prisma.InputJsonValue),
            timeTakenMs: row.timeTakenMs,
            isCorrect: row.isCorrect,
            score: row.score,
          },
        }),
        this.prisma.db.soloAttempt.update({
          where: { id: attemptId },
          data: {
            score: { increment: row.score },
            correctCount: { increment: row.isCorrect ? 1 : 0 },
          },
        }),
      ]);
    } catch (e) {
      // Already answered (a double submit): the first one stands.
      if (
        !(e instanceof Prisma.PrismaClientKnownRequestError) ||
        e.code !== "P2002"
      ) {
        throw e;
      }
    }
  }

  private reload(attemptId: string): Promise<AttemptRow> {
    return this.prisma.db.soloAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: { answers: true },
    });
  }

  private async testByCode(code: string): Promise<TestRow> {
    const test = await this.prisma.db.soloTest.findUnique({
      where: { code: code.toUpperCase() },
      include: { host: { select: { name: true, image: true } } },
    });
    if (!test) throw new NotFoundException("Test not found");
    return test;
  }

  private async ownTest(user: AuthUser, id: string) {
    const test = await this.prisma.db.soloTest.findFirst({
      where: { id, hostId: user.userId },
    });
    if (!test) throw new NotFoundException("Test not found");
    return test;
  }

  private async ownAttempt(playerId: string, attemptId: string) {
    const attempt = await this.prisma.db.soloAttempt.findUnique({
      where: { id: attemptId },
      include: {
        answers: true,
        test: { include: { host: { select: { name: true, image: true } } } },
      },
    });
    if (!attempt || attempt.playerId !== playerId) {
      throw new NotFoundException("Attempt not found");
    }
    const { test, ...rest } = attempt;
    return { test, attempt: rest };
  }

  private item(
    test: {
      id: string;
      code: string;
      quizId: string | null;
      title: string;
      questions: Prisma.JsonValue;
      closesAt: Date | null;
      createdAt: Date;
    },
    started: number,
    finished: number,
  ): SoloTestItem {
    return {
      id: test.id,
      code: test.code,
      quizId: test.quizId,
      title: test.title,
      questionCount: questionsOf(test).length,
      closesAt: test.closesAt?.toISOString() ?? null,
      closed: isClosed(test),
      createdAt: test.createdAt.toISOString(),
      started,
      finished,
    };
  }
}
