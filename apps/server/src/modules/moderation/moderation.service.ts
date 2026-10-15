import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  MAX_QUESTION_CATEGORIES,
  type BulkModerationResult,
  type BulkSetCategories,
  type ModerationCounts,
  type ModerationListStatus,
} from "@buzrr/contract";
import { Prisma } from "@buzrr/prisma";
import { CategoriesService } from "../categories/categories.service";
import { PrismaService } from "../../prisma/prisma.service";
import { isDuelEligible } from "../question-types";

const REPORT_THRESHOLD = 5; // the 6th distinct reporter triggers auto-unapprove
const DEFAULT_LIMIT = 20;
const NOT_FOUND = "Question not found";
const NOT_DUEL_ELIGIBLE =
  "Only single-answer multiple choice and true / false questions can be reviewed for duels";

const LIST_ORDER: Record<
  ModerationListStatus,
  Prisma.QuestionOrderByWithRelationInput[]
> = {
  pending: [{ createdAt: "asc" }, { id: "asc" }],
  approved: [{ createdAt: "desc" }, { id: "desc" }],
  unapproved: [{ reportCount: "desc" }, { createdAt: "desc" }, { id: "desc" }],
};

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

  /**
   * One moderation tab, cursor-paginated. Pending is oldest first (a queue);
   * unapproved puts report-flagged questions on top; approved is newest first.
   */
  async listQueue(params: {
    status?: ModerationListStatus;
    cursor?: string;
    limit?: number;
  }) {
    const limit = params.limit ?? DEFAULT_LIMIT;
    const status = params.status ?? "pending";
    const where: Prisma.QuestionWhereInput = { moderationStatus: status };

    const rows = await this.prisma.db.question.findMany({
      where,
      orderBy: LIST_ORDER[status],
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: {
        options: true,
        quiz: {
          select: {
            id: true,
            title: true,
            user: { select: { name: true, email: true } },
          },
        },
        createdBy: { select: { name: true, email: true } },
        categories: {
          select: { category: { select: { id: true, name: true, hue: true } } },
        },
      },
    });

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(
      ({ categories, ...row }) => ({
        ...row,
        categories: categories.map((c) => c.category),
      }),
    );
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]!.id : null,
    };
  }

  /** Question count per moderation tab. */
  async counts(): Promise<ModerationCounts> {
    const groups = await this.prisma.db.question.groupBy({
      by: ["moderationStatus"],
      where: {
        moderationStatus: { in: ["pending", "approved", "unapproved"] },
      },
      _count: { _all: true },
    });
    const counts: ModerationCounts = { pending: 0, approved: 0, unapproved: 0 };
    for (const group of groups) {
      if (group.moderationStatus in counts) {
        counts[group.moderationStatus as keyof ModerationCounts] =
          group._count._all;
      }
    }
    return counts;
  }

  /**
   * Retag a question. Categories only steer which duel pool serves it, so an
   * admin retag doesn't send the question back through moderation.
   */
  async setCategories(questionId: string, categoryIds: string[]) {
    const ids = await this.categories.assertExist(categoryIds);
    const question = await this.prisma.db.question.findUnique({
      where: { id: questionId },
      select: { id: true },
    });
    if (!question) throw new NotFoundException("Question not found");
    await this.prisma.db.$transaction([
      this.prisma.db.questionCategory.deleteMany({ where: { questionId } }),
      this.prisma.db.questionCategory.createMany({
        data: ids.map((categoryId) => ({ questionId, categoryId })),
      }),
    ]);
  }

  async approve(questionId: string) {
    await this.transitionOne(questionId, "approved");
  }

  async unapprove(questionId: string) {
    await this.transitionOne(questionId, "unapproved");
  }

  bulkApprove(ids: string[]): Promise<BulkModerationResult> {
    return this.transitionDecisions(ids, "approved");
  }

  bulkUnapprove(ids: string[]): Promise<BulkModerationResult> {
    return this.transitionDecisions(ids, "unapproved");
  }

  /** Send decided questions back to the review queue. */
  async moveToPending(questionId: string) {
    await this.transitionOne(questionId, "pending");
  }

  bulkMoveToPending(ids: string[]): Promise<BulkModerationResult> {
    return this.transitionDecisions(ids, "pending");
  }

  /** The single-question endpoints keep their 404 / 400 errors. */
  private async transitionOne(
    questionId: string,
    moderationStatus: ModerationListStatus,
  ): Promise<void> {
    const { skipped } = await this.transitionDecisions(
      [questionId],
      moderationStatus,
    );
    const reason = skipped[0]?.reason;
    if (reason === NOT_FOUND) {
      throw new NotFoundException("Question not found");
    }
    if (reason) throw new BadRequestException(reason);
  }

  /**
   * Approve, unapprove or re-queue many questions at once; every move clears
   * the question's reports. Missing ids, and content duels can't play (for
   * approve and pending — a queued question must be approvable), are skipped
   * and reported back rather than failing the batch.
   */
  private async transitionDecisions(
    ids: string[],
    moderationStatus: ModerationListStatus,
  ): Promise<BulkModerationResult> {
    const unique = [...new Set(ids)];
    const questions = await this.prisma.db.question.findMany({
      where: { id: { in: unique } },
      select: { id: true, type: true, config: true, options: true },
    });
    const found = new Map(questions.map((q) => [q.id, q]));
    const skipped: BulkModerationResult["skipped"] = [];
    const accepted: string[] = [];
    for (const id of unique) {
      const question = found.get(id);
      if (!question) {
        skipped.push({ id, reason: NOT_FOUND });
      } else if (
        moderationStatus !== "unapproved" &&
        !isDuelEligible(question.type, {
          options: question.options,
          config: question.config,
        })
      ) {
        skipped.push({ id, reason: NOT_DUEL_ELIGIBLE });
      } else {
        accepted.push(id);
      }
    }
    if (accepted.length > 0) {
      await this.prisma.db.$transaction([
        this.prisma.db.question.updateMany({
          where: { id: { in: accepted } },
          data: { moderationStatus, reportCount: 0 },
        }),
        this.prisma.db.questionReport.deleteMany({
          where: { questionId: { in: accepted } },
        }),
      ]);
    }
    return { updated: accepted.length, skipped };
  }

  /**
   * Retag many questions. `add` keeps existing tags (a question that would go
   * over the category cap is skipped), `remove` drops the given ones, and
   * `replace` sets exactly these. Like a single retag, no re-moderation.
   */
  async bulkSetCategories(
    body: BulkSetCategories,
  ): Promise<BulkModerationResult> {
    const categoryIds = await this.categories.assertExist(body.categoryIds);
    const unique = [...new Set(body.ids)];
    const questions = await this.prisma.db.question.findMany({
      where: { id: { in: unique } },
      select: { id: true, categories: { select: { categoryId: true } } },
    });
    const found = new Map(questions.map((q) => [q.id, q]));
    const skipped: BulkModerationResult["skipped"] = [];
    const accepted: string[] = [];
    for (const id of unique) {
      const question = found.get(id);
      if (!question) {
        skipped.push({ id, reason: NOT_FOUND });
        continue;
      }
      if (body.mode === "add") {
        const tags = new Set(question.categories.map((c) => c.categoryId));
        for (const categoryId of categoryIds) tags.add(categoryId);
        if (tags.size > MAX_QUESTION_CATEGORIES) {
          skipped.push({
            id,
            reason: `A question can have at most ${MAX_QUESTION_CATEGORIES} categories`,
          });
          continue;
        }
      }
      accepted.push(id);
    }

    if (accepted.length > 0) {
      const tagRows = accepted.flatMap((questionId) =>
        categoryIds.map((categoryId) => ({ questionId, categoryId })),
      );
      const db = this.prisma.db;
      if (body.mode === "add") {
        await db.questionCategory.createMany({
          data: tagRows,
          skipDuplicates: true,
        });
      } else if (body.mode === "remove") {
        await db.questionCategory.deleteMany({
          where: {
            questionId: { in: accepted },
            categoryId: { in: categoryIds },
          },
        });
      } else {
        await db.$transaction([
          db.questionCategory.deleteMany({
            where: { questionId: { in: accepted } },
          }),
          db.questionCategory.createMany({ data: tagRows }),
        ]);
      }
    }
    return { updated: accepted.length, skipped };
  }

  /** Only approved questions (the only status a player could ever see) can be reported. */
  async reportQuestion(
    questionId: string,
    reporterUserId: string,
  ): Promise<void> {
    const question = await this.prisma.db.question.findUnique({
      where: { id: questionId },
      select: { id: true, moderationStatus: true },
    });
    if (!question) {
      throw new NotFoundException("Question not found");
    }
    if (question.moderationStatus !== "approved") {
      throw new BadRequestException("Only approved questions can be reported");
    }

    try {
      await this.prisma.db.questionReport.create({
        data: { questionId, reporterUserId },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return; // already reported by this user -- idempotent no-op
      }
      throw err;
    }

    // A new distinct reporter got past the unique-constraint guard above, so a
    // single atomic increment is exactly one bump per distinct report (no
    // read-modify-write race).
    const updated = await this.prisma.db.question.update({
      where: { id: questionId },
      data: { reportCount: { increment: 1 } },
      select: { reportCount: true },
    });
    if (updated.reportCount > REPORT_THRESHOLD) {
      await this.prisma.db.question.update({
        where: { id: questionId },
        data: { moderationStatus: "unapproved" },
      });
    }
  }
}
