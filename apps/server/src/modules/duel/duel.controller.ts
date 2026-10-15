import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  createDuelInviteSchema,
  setTimeZoneSchema,
  streakMonthQuerySchema,
  type CreateDuelInvite,
  type DuelProfile,
  type DuelRecord,
  type SetTimeZone,
  type StreakMonth,
} from "@buzrr/contract";
import { CurrentAccountUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { RateLimitProfile } from "../../common/decorators/rate-limit-profile.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import {
  dateToDay,
  dayToDate,
  effectiveStreak,
  isValidTimeZone,
  localDay,
} from "../../common/utils/daily-streak";
import { PrismaService } from "../../prisma/prisma.service";
import { DuelInviteService } from "./duel-invite.service";
import {
  DuelCategoryUnavailableError,
  DuelQuestionsService,
} from "./duel-questions.service";
import { InviteCodeParamDto } from "./dto/duel-invite.dto";

@Controller("duel")
export class DuelController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invites: DuelInviteService,
    private readonly questions: DuelQuestionsService,
  ) {}

  /** Ratings, win/loss records (Random + per category) and the streak. */
  @Get("me")
  async me(@CurrentAccountUser() user: AuthUser): Promise<DuelProfile> {
    const [record, ratings, outcomes] = await Promise.all([
      this.prisma.db.user.findUnique({
        where: { id: user.userId },
        select: {
          id: true,
          name: true,
          image: true,
          eloRating: true,
          duelsPlayed: true,
          timeZone: true,
          currentStreak: true,
          bestStreak: true,
          lastStreakDay: true,
        },
      }),
      this.prisma.db.userCategoryRating.findMany({
        where: { userId: user.userId },
        select: { categoryId: true, rating: true, duelsPlayed: true },
      }),
      this.prisma.db.$queryRaw<
        { categoryId: string | null; outcome: string; n: bigint }[]
      >`
        SELECT r."categoryId", e."outcome", count(*) AS n
        FROM "GameResultEntry" e
        JOIN "GameResult" r ON r."id" = e."gameResultId"
        WHERE e."userId" = ${user.userId}
          AND r."mode" = 'duel'
          AND e."outcome" IS NOT NULL
        GROUP BY r."categoryId", e."outcome"
      `,
    ]);
    if (!record) {
      throw new NotFoundException("User not found");
    }

    const records = new Map<string | null, DuelRecord>();
    const recordFor = (categoryId: string | null) => {
      let r = records.get(categoryId);
      if (!r) {
        r = { rating: 1200, ratedDuels: 0, wins: 0, losses: 0, draws: 0 };
        records.set(categoryId, r);
      }
      return r;
    };
    for (const row of outcomes) {
      const r = recordFor(row.categoryId);
      const n = Number(row.n);
      if (row.outcome === "win") r.wins += n;
      else if (row.outcome === "loss") r.losses += n;
      else r.draws += n;
    }
    for (const rating of ratings) {
      const r = recordFor(rating.categoryId);
      r.rating = rating.rating;
      r.ratedDuels = rating.duelsPlayed;
    }
    const random = recordFor(null);
    random.rating = record.eloRating;
    random.ratedDuels = record.duelsPlayed;

    const today = localDay(new Date(), record.timeZone);
    const lastDay = record.lastStreakDay
      ? dateToDay(record.lastStreakDay)
      : null;
    return {
      id: record.id,
      name: record.name,
      image: record.image,
      eloRating: record.eloRating,
      duelsPlayed: record.duelsPlayed,
      timeZone: record.timeZone,
      streak: {
        current: effectiveStreak(record.currentStreak, lastDay, today),
        best: record.bestStreak,
        playedToday: lastDay === today,
        today,
      },
      random,
      categories: [...records.entries()]
        .filter((entry): entry is [string, DuelRecord] => entry[0] !== null)
        .map(([categoryId, r]) => ({ categoryId, ...r })),
    };
  }

  /** The browser's IANA zone; decides what "today" means for the streak. */
  @Put("me/timezone")
  @HttpCode(204)
  async setTimeZone(
    @CurrentAccountUser() user: AuthUser,
    @Body(new ZodValidationPipe(setTimeZoneSchema)) body: SetTimeZone,
  ): Promise<void> {
    if (!isValidTimeZone(body.timeZone)) {
      throw new BadRequestException("Unknown time zone");
    }
    await this.prisma.db.user.update({
      where: { id: user.userId },
      data: { timeZone: body.timeZone },
    });
  }

  /** Days in one month (the user's calendar) on which a duel counted. */
  @Get("streak")
  async streak(
    @CurrentAccountUser() user: AuthUser,
    @Query(new ZodValidationPipe(streakMonthQuerySchema))
    query: { month: string },
  ): Promise<StreakMonth> {
    const first = dayToDate(`${query.month}-01`);
    const next = new Date(first);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const rows = await this.prisma.db.duelDay.findMany({
      where: { userId: user.userId, day: { gte: first, lt: next } },
      select: { day: true },
      orderBy: { day: "asc" },
    });
    return {
      month: query.month,
      days: rows.map((r) => r.day.getUTCDate()),
    };
  }

  /** Categories a duel can be played in (enough approved questions). */
  @Get("categories")
  categories() {
    return this.questions.listCategories();
  }

  /**
   * Mints a friend-challenge link. Returns the code rather than a URL: only the
   * web app knows the public origin (`NEXT_PUBLIC_APP_URL`); the server's
   * `WEB_ORIGIN` may be a comma-separated CORS list.
   */
  @Post("invites")
  @UseGuards(RateLimitGuard)
  @RateLimitProfile("report")
  async createInvite(
    @CurrentAccountUser() user: AuthUser,
    @Body(new ZodValidationPipe(createDuelInviteSchema))
    body: CreateDuelInvite,
  ) {
    let category;
    try {
      category = await this.questions.resolveCategory(body.categoryId);
    } catch (err) {
      if (err instanceof DuelCategoryUnavailableError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
    const record = await this.prisma.db.user.findUnique({
      where: { id: user.userId },
      select: { id: true, name: true, image: true, eloRating: true },
    });
    if (!record) {
      throw new NotFoundException("User not found");
    }
    return this.invites.create(
      {
        id: record.id,
        name: record.name,
        image: record.image,
        elo: record.eloRating,
      },
      category,
    );
  }

  @Get("invites/:code")
  @UseGuards(RateLimitGuard)
  async getInvite(
    @Param() params: InviteCodeParamDto,
    @CurrentAccountUser() user: AuthUser,
  ) {
    const invite = await this.invites.get(params.code, user.userId);
    if (!invite) {
      throw new NotFoundException("This challenge link has expired");
    }
    return invite;
  }

  @Delete("invites/:code")
  @UseGuards(RateLimitGuard)
  @HttpCode(204)
  async cancelInvite(
    @Param() params: InviteCodeParamDto,
    @CurrentAccountUser() user: AuthUser,
  ) {
    const outcome = await this.invites.cancel(params.code, user.userId);
    if (outcome === "claimed") {
      throw new ConflictException("This challenge has already been accepted");
    }
    if (outcome === "forbidden") {
      throw new ForbiddenException("You can only cancel your own challenge");
    }
  }

  @Get("recent")
  async recent(
    @CurrentAccountUser() user: AuthUser,
    @Query("limit") limit?: string,
  ) {
    const take = Math.min(Math.max(parseInt(limit ?? "", 10) || 10, 1), 50);
    return this.prisma.db.gameResultEntry.findMany({
      where: { userId: user.userId, result: { mode: "duel" } },
      orderBy: { result: { endedAt: "desc" } },
      take,
      include: {
        result: {
          include: { entries: true },
        },
      },
    });
  }
}
