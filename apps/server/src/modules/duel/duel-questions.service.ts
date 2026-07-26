import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { LiveQuestion } from "../game-engine/game-engine.types";

const DUEL_QUESTION_COUNT = 7;
const MIN_QUESTIONS = 3;

/**
 * Builds the question set every duel runs on — shared by ELO matchmaking and
 * friend invites so both draw from the same pool with the same guarantees.
 */
@Injectable()
export class DuelQuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Random questions drawn from public quizzes, snapshotted into Redis. */
  async build(): Promise<LiveQuestion[]> {
    const ids = await this.prisma.db.$queryRaw<{ id: string }[]>`
      SELECT q."id" FROM "Question" q
      JOIN "Quiz" z ON z."id" = q."quizId"
      WHERE z."isPublic" = true
        AND q."moderationStatus" = 'approved'
      ORDER BY random()
      LIMIT ${DUEL_QUESTION_COUNT}
    `;
    const rows = await this.prisma.db.question.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
      include: { options: { orderBy: { createdAt: "asc" } } },
    });
    // findMany ignores the `IN` order, so restore the raw query's shuffle.
    const byId = new Map(rows.map((q) => [q.id, q]));
    const ordered = ids
      .map((r) => byId.get(r.id))
      .filter((q): q is (typeof rows)[number] => q !== undefined);
    const questions: LiveQuestion[] = ordered
      .filter(
        (q) => q.options.length >= 2 && q.options.some((o) => o.isCorrect),
      )
      .map((q) => ({
        id: q.id,
        title: q.title,
        media: q.media,
        mediaType: q.mediaType,
        timeOut: q.timeOut,
        options: q.options.map((o) => ({
          id: o.id,
          title: o.title,
          isCorrect: o.isCorrect,
        })),
      }));
    if (questions.length < MIN_QUESTIONS) {
      throw new Error(
        `Only ${questions.length} usable public questions (need ${MIN_QUESTIONS})`,
      );
    }
    return questions;
  }
}
