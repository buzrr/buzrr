import {
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentAccountUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { RateLimitProfile } from "../../common/decorators/rate-limit-profile.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { PrismaService } from "../../prisma/prisma.service";
import { DuelInviteService } from "./duel-invite.service";
import { InviteCodeParamDto } from "./dto/duel-invite.dto";

@Controller("duel")
export class DuelController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invites: DuelInviteService,
  ) {}

  @Get("me")
  async me(@CurrentAccountUser() user: AuthUser) {
    const record = await this.prisma.db.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        name: true,
        image: true,
        eloRating: true,
        duelsPlayed: true,
      },
    });
    if (!record) {
      throw new NotFoundException("User not found");
    }
    return record;
  }

  /**
   * Mints a friend-challenge link. Returns the code rather than a URL: only the
   * web app knows the public origin (`NEXT_PUBLIC_APP_URL`); the server's
   * `WEB_ORIGIN` may be a comma-separated CORS list.
   */
  @Post("invites")
  @UseGuards(RateLimitGuard)
  @RateLimitProfile("report")
  async createInvite(@CurrentAccountUser() user: AuthUser) {
    const record = await this.prisma.db.user.findUnique({
      where: { id: user.userId },
      select: { id: true, name: true, image: true, eloRating: true },
    });
    if (!record) {
      throw new NotFoundException("User not found");
    }
    return this.invites.create({
      id: record.id,
      name: record.name,
      image: record.image,
      elo: record.eloRating,
    });
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
