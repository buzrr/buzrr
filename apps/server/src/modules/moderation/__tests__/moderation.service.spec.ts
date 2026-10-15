import { randomUUID } from "node:crypto";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { prisma } from "@buzrr/prisma";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { MediaStorage } from "../../../common/storage/media-storage";
import type { PrismaService } from "../../../prisma/prisma.service";
import { CategoriesService } from "../../categories/categories.service";
import { QuestionsService } from "../../questions/questions.service";
import { requireDatabase } from "../../billing/__tests__/helpers";
import { ModerationService } from "../moderation.service";

const prismaService = { db: prisma } as unknown as PrismaService;
const categories = new CategoriesService(prismaService);
const moderation = new ModerationService(prismaService, categories);

const run = `mod-test-${randomUUID().slice(0, 8)}`;
let userId = "";
const categoryIds: string[] = [];

async function createCategory(label: string): Promise<string> {
  const row = await prisma.category.create({
    data: { name: `${run} ${label}`, slug: `${run}-${label}` },
    select: { id: true },
  });
  categoryIds.push(row.id);
  return row.id;
}

/** A standalone question; MCQ with one correct answer unless told otherwise. */
async function createQuestion(
  fields: {
    type?: string;
    moderationStatus?: "pending" | "approved" | "unapproved";
    reportCount?: number;
    categoryIds?: string[];
  } = {},
): Promise<string> {
  const row = await prisma.question.create({
    data: {
      title: `${run} question`,
      type: fields.type ?? "multiple_choice",
      createdById: userId,
      moderationStatus: fields.moderationStatus ?? "pending",
      reportCount: fields.reportCount ?? 0,
      options: {
        create: [
          { title: "A", isCorrect: true },
          { title: "B", isCorrect: false },
        ],
      },
      categories: {
        create: (fields.categoryIds ?? []).map((categoryId) => ({
          categoryId,
        })),
      },
    },
    select: { id: true },
  });
  return row.id;
}

async function tagsOf(questionId: string): Promise<string[]> {
  const rows = await prisma.questionCategory.findMany({
    where: { questionId },
    select: { categoryId: true },
  });
  return rows.map((r) => r.categoryId).sort();
}

describe("ModerationService", () => {
  let dbUp = false;

  beforeAll(async () => {
    dbUp = await requireDatabase();
    if (!dbUp) return;
    const user = await prisma.user.create({
      data: { email: `${run}@example.test`, name: "Moderation Test" },
      select: { id: true },
    });
    userId = user.id;
  });

  beforeEach((ctx) => {
    if (!dbUp) ctx.skip();
  });

  afterAll(async () => {
    if (!dbUp) return;
    await prisma.question.deleteMany({ where: { createdById: userId } });
    await prisma.quiz.deleteMany({ where: { userId } });
    await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("lists one status per tab, report-flagged first among unapproved", async () => {
    const pending = await createQuestion();
    const quiet = await createQuestion({ moderationStatus: "unapproved" });
    const flagged = await createQuestion({
      moderationStatus: "unapproved",
      reportCount: 6,
    });

    const pendingIds = await collect("pending");
    expect(pendingIds).toContain(pending);
    expect(pendingIds).not.toContain(quiet);

    const unapprovedIds = (await collect("unapproved")).filter((id) =>
      [quiet, flagged].includes(id),
    );
    expect(unapprovedIds).toEqual([flagged, quiet]);
  });

  it("counts every tab", async () => {
    const before = await moderation.counts();
    await createQuestion({ moderationStatus: "approved" });
    const after = await moderation.counts();
    expect(after.approved).toBe(before.approved + 1);
    expect(after.pending).toBe(before.pending);
  });

  it("bulk-approves eligible questions, skipping missing and non-duel ones", async () => {
    const good = await createQuestion({ reportCount: 2 });
    const poll = await createQuestion({ type: "poll" });

    const result = await moderation.bulkApprove([good, poll, "missing-id"]);

    expect(result.updated).toBe(1);
    expect(result.skipped.map((s) => s.id).sort()).toEqual(
      ["missing-id", poll].sort(),
    );
    const row = await prisma.question.findUniqueOrThrow({
      where: { id: good },
    });
    expect(row.moderationStatus).toBe("approved");
    expect(row.reportCount).toBe(0);
  });

  it("keeps single-question errors", async () => {
    const poll = await createQuestion({ type: "poll" });
    await expect(moderation.approve(poll)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(moderation.unapprove("missing-id")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("bulk-unapproves any listed question", async () => {
    const approved = await createQuestion({ moderationStatus: "approved" });
    const result = await moderation.bulkUnapprove([approved]);
    expect(result).toEqual({ updated: 1, skipped: [] });
  });

  it("moves decided questions back to pending, skipping non-duel ones", async () => {
    const approved = await createQuestion({ moderationStatus: "approved" });
    const flagged = await createQuestion({
      moderationStatus: "unapproved",
      reportCount: 6,
    });
    const poll = await createQuestion({
      type: "poll",
      moderationStatus: "unapproved",
    });

    const result = await moderation.bulkMoveToPending([
      approved,
      flagged,
      poll,
    ]);

    expect(result.updated).toBe(2);
    expect(result.skipped.map((s) => s.id)).toEqual([poll]);
    const rows = await prisma.question.findMany({
      where: { id: { in: [approved, flagged] } },
      select: { moderationStatus: true, reportCount: true },
    });
    expect(rows).toEqual([
      { moderationStatus: "pending", reportCount: 0 },
      { moderationStatus: "pending", reportCount: 0 },
    ]);
    expect(await collect("pending")).toEqual(
      expect.arrayContaining([approved, flagged]),
    );
  });

  it("adds, removes and replaces categories in bulk", async () => {
    const [a, b, c] = await Promise.all([
      createCategory("a"),
      createCategory("b"),
      createCategory("c"),
    ]);
    const q1 = await createQuestion({ categoryIds: [a] });
    const q2 = await createQuestion();

    await moderation.bulkSetCategories({
      ids: [q1, q2],
      categoryIds: [a, b],
      mode: "add",
    });
    expect(await tagsOf(q1)).toEqual([a, b].sort());
    expect(await tagsOf(q2)).toEqual([a, b].sort());

    await moderation.bulkSetCategories({
      ids: [q1, q2],
      categoryIds: [a],
      mode: "remove",
    });
    expect(await tagsOf(q1)).toEqual([b]);

    await moderation.bulkSetCategories({
      ids: [q1],
      categoryIds: [c],
      mode: "replace",
    });
    expect(await tagsOf(q1)).toEqual([c]);
    expect(await tagsOf(q2)).toEqual([b]);
  });

  it("skips a question an add would push over the category cap", async () => {
    const ids = await Promise.all(
      ["d", "e", "f", "g", "h", "i"].map((l) => createCategory(l)),
    );
    const full = await createQuestion({ categoryIds: ids.slice(0, 5) });
    const result = await moderation.bulkSetCategories({
      ids: [full],
      categoryIds: [ids[5]!],
      mode: "add",
    });
    expect(result.updated).toBe(0);
    expect(result.skipped[0]?.id).toBe(full);
    expect(await tagsOf(full)).toHaveLength(5);
  });

  it("ignores categoryIds on a quiz question save", async () => {
    const category = await createCategory("quiz");
    const quiz = await prisma.quiz.create({
      data: { title: `${run} quiz`, userId, isPublic: true },
      select: { id: true },
    });
    const questions = new QuestionsService(
      prismaService,
      {} as MediaStorage,
      categories,
    );
    await questions.upsertFromMultipart(
      { userId } as never,
      quiz.id,
      {
        title: "Capital of France?",
        option1: "Paris",
        option2: "Rome",
        option3: "Berlin",
        option4: "Madrid",
        choose_option: "a",
        categoryIds: JSON.stringify([category]),
      },
      undefined,
    );
    const row = await prisma.question.findFirstOrThrow({
      where: { quizId: quiz.id },
      select: { id: true },
    });
    expect(await tagsOf(row.id)).toEqual([]);
  });
});

/** Every id in a tab, walking the cursor. */
async function collect(
  status: "pending" | "approved" | "unapproved",
): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await moderation.listQueue({ status, cursor, limit: 100 });
    ids.push(...page.items.map((item) => item.id));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return ids;
}
