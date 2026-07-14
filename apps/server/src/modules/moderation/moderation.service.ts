import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@buzrr/prisma";
import { PrismaService } from "../../prisma/prisma.service";

const REPORT_THRESHOLD = 5; // the 6th distinct reporter triggers auto-unapprove
const DEFAULT_LIMIT = 20;

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pending questions, plus previously-approved ones that got auto-flagged by reports. */
  async listQueue(params: { cursor?: string; limit?: number }) {
    const limit = params.limit ?? DEFAULT_LIMIT;
    const where: Prisma.QuestionWhereInput = {
      OR: [
        { moderationStatus: "pending" },
        { moderationStatus: "unapproved", reportCount: { gt: 0 } },
      ],
    };

    const rows = await this.prisma.db.question.findMany({
      where,
      orderBy: [
        { reportCount: "desc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      take: limit + 1,
      ...(params.cursor
        ? { cursor: { id: params.cursor }, skip: 1 }
        : {}),
      include: {
        options: true,
        quiz: {
          select: {
            id: true,
            title: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]!.id : null,
    };
  }

  async approve(questionId: string) {
    await this.transitionDecision(questionId, "approved");
  }

  async unapprove(questionId: string) {
    await this.transitionDecision(questionId, "unapproved");
  }

  private async transitionDecision(
    questionId: string,
    moderationStatus: "approved" | "unapproved",
  ): Promise<void> {
    const question = await this.prisma.db.question.findUnique({
      where: { id: questionId },
      select: { id: true },
    });
    if (!question) {
      throw new NotFoundException("Question not found");
    }
    await this.prisma.db.$transaction([
      this.prisma.db.question.update({
        where: { id: questionId },
        data: { moderationStatus, reportCount: 0 },
      }),
      this.prisma.db.questionReport.deleteMany({ where: { questionId } }),
    ]);
  }

  /** Only approved questions (the only status a player could ever see) can be reported. */
  async reportQuestion(questionId: string, reporterUserId: string): Promise<void> {
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
