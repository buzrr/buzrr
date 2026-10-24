import { Body, Controller, Get, Patch } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { PreferencesService } from "./preferences.service";
import { CurrentAccountUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";

const preferencesPatchSchema = z.object({
  defaultSoundSkin: z.string().max(64).optional(),
});

@Controller("users")
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly preferences: PreferencesService,
  ) {}

  @Get("me/preferences")
  myPreferences(@CurrentAccountUser() user: AuthUser) {
    return this.preferences.get(user.userId);
  }

  @Patch("me/preferences")
  updatePreferences(
    @CurrentAccountUser() user: AuthUser,
    @Body(new ZodValidationPipe(preferencesPatchSchema))
    body: z.infer<typeof preferencesPatchSchema>,
  ) {
    return this.preferences.update(user.userId, body);
  }

  @Get("me/stats")
  async myStats(@CurrentAccountUser() user: AuthUser) {
    const userId = user.userId;
    const [quizzesCreated, gamesHosted, entryAgg, wins] = await Promise.all([
      this.prisma.db.quiz.count({ where: { userId } }),
      this.prisma.db.gameResult.count({ where: { hostId: userId } }),
      this.prisma.db.gameResultEntry.aggregate({
        where: { userId },
        _count: { _all: true },
        _avg: { score: true, correctCount: true },
      }),
      this.prisma.db.gameResultEntry.count({ where: { userId, rank: 1 } }),
    ]);

    const gamesPlayed = entryAgg._count._all;
    return {
      quizzesCreated,
      gamesHosted,
      gamesPlayed,
      wins,
      winRate: gamesPlayed > 0 ? wins / gamesPlayed : 0,
      avgScore: Math.round(entryAgg._avg.score ?? 0),
      avgCorrectCount: Math.round((entryAgg._avg.correctCount ?? 0) * 10) / 10,
    };
  }
}
