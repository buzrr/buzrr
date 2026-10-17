import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { z } from "zod";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { PreferencesService } from "./preferences.service";
import { CurrentAccountUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { PrismaService } from "../../prisma/prisma.service";

const preferencesPatchSchema = z.object({
  defaultSoundSkin: z.string().max(64).optional(),
  defaultAvatarSkin: z.string().max(16).optional(),
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

  /** Sets (file) or clears (no file) the default logo. */
  @Post("me/logo")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  setLogo(
    @CurrentAccountUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.preferences.setLogo(user.userId, file ?? null);
  }

  /** "Your skin": add a picture (resized to a square). */
  @Post("me/avatars")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  addAvatar(
    @CurrentAccountUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.preferences.addAvatar(user.userId, file);
  }

  @Delete("me/avatars")
  removeAvatar(
    @CurrentAccountUser() user: AuthUser,
    @Query("url") url: string,
  ) {
    return this.preferences.removeAvatar(user.userId, url ?? "");
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
