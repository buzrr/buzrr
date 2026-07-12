import { Controller, Get, NotFoundException } from "@nestjs/common";
import { CurrentAccountUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("duel")
export class DuelController {
  constructor(private readonly prisma: PrismaService) {}

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

  @Get("recent")
  async recent(@CurrentAccountUser() user: AuthUser) {
    return this.prisma.db.gameResultEntry.findMany({
      where: { userId: user.userId, result: { mode: "duel" } },
      orderBy: { result: { endedAt: "desc" } },
      take: 10,
      include: {
        result: {
          include: { entries: true },
        },
      },
    });
  }
}
