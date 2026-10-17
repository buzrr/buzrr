import { Injectable } from "@nestjs/common";
import { Prisma } from "@buzrr/prisma";
import type { DuelCategoriesResponse, DuelCategoryRef } from "@buzrr/contract";
import { PrismaService } from "../../prisma/prisma.service";
import { toLiveQuestion, type LiveQuestion } from "../question-types";

export const DUEL_QUESTION_COUNT = 7;
const MIN_QUESTIONS = 3;

/**
 * The duel pool: approved questions that are either standalone (no quiz) or
 * in a public quiz. `q` is the "Question" alias.
 */
const POOL_WHERE = Prisma.sql`
  (q."quizId" IS NULL OR EXISTS (
    SELECT 1 FROM "Quiz" z WHERE z."id" = q."quizId" AND z."isPublic" = true
  ))
  AND q."moderationStatus" = 'approved'
  -- Duels score head to head: one right answer, scored types only
  -- (approval already requires this; kept here as the last guard).
  AND q."type" IN ('multiple_choice', 'true_false')
  -- True / false keeps its key in config (no options); the handler checks it.
  AND (q."type" = 'true_false' OR (
    SELECT count(*) FROM "Option" o
    WHERE o."questionId" = q."id" AND o."isCorrect" = true
  ) = 1)
`;

/** Thrown when a category can't currently host a duel. */
export class DuelCategoryUnavailableError extends Error {}

/**
 * Builds the question set every duel runs on — shared by ELO matchmaking and
 * friend invites so both draw from the same pool with the same guarantees.
 */
@Injectable()
export class DuelQuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Random questions from the pool (optionally one category), snapshotted
   * into Redis by the caller.
   */
  async build(categoryId: string | null = null): Promise<LiveQuestion[]> {
    const categoryFilter = categoryId
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM "QuestionCategory" qc
          WHERE qc."questionId" = q."id" AND qc."categoryId" = ${categoryId}
        )`
      : Prisma.empty;
    const ids = await this.prisma.db.$queryRaw<{ id: string }[]>`
      SELECT q."id" FROM "Question" q
      WHERE ${POOL_WHERE} ${categoryFilter}
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
    // Each type's own checks decide what is playable (e.g. multiple choice
    // needs options and exactly one right answer); anything else is skipped.
    const questions = ordered
      .map((q) => toLiveQuestion(q))
      .filter((q): q is LiveQuestion => q !== null);
    if (questions.length < MIN_QUESTIONS) {
      throw new Error(
        `Only ${questions.length} usable duel questions${categoryId ? ` in category ${categoryId}` : ""} (need ${MIN_QUESTIONS})`,
      );
    }
    return questions;
  }

  /**
   * Categories players can pick: those with a full duel's worth of pool
   * questions, most played first.
   */
  async listCategories(): Promise<DuelCategoriesResponse> {
    const [rows, randomPlays] = await Promise.all([
      this.prisma.db.$queryRaw<
        {
          id: string;
          slug: string;
          name: string;
          hue: number;
          plays: bigint;
        }[]
      >`
        SELECT c."id", c."slug", c."name", c."hue",
          (SELECT count(*) FROM "GameResult" r WHERE r."categoryId" = c."id") AS plays
        FROM "Category" c
        WHERE (
          SELECT count(*) FROM "QuestionCategory" qc
          JOIN "Question" q ON q."id" = qc."questionId"
          WHERE qc."categoryId" = c."id" AND ${POOL_WHERE}
        ) >= ${DUEL_QUESTION_COUNT}
        ORDER BY plays DESC, c."name" ASC
      `,
      this.prisma.db.gameResult.count({
        where: { mode: "duel", categoryId: null },
      }),
    ]);
    return {
      randomPlays,
      categories: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        hue: r.hue,
        plays: Number(r.plays),
      })),
    };
  }

  /**
   * Resolves a requested category for a new duel. Null/undefined is Random.
   * Throws DuelCategoryUnavailableError for unknown ids.
   */
  async resolveCategory(
    categoryId: string | null | undefined,
  ): Promise<DuelCategoryRef> {
    if (!categoryId) return null;
    const category = await this.prisma.db.category.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true },
    });
    if (!category) {
      throw new DuelCategoryUnavailableError("That category doesn't exist.");
    }
    return category;
  }
}
