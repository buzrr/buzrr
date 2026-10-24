import { BadRequestException, Injectable } from "@nestjs/common";
import type { UserPreferences } from "@buzrr/contract";
import { PrismaService } from "../../prisma/prisma.service";
import { preferencesOf } from "../../common/game-look/game-look";

/** A user's defaults (the default audio skin). */
@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string): Promise<UserPreferences> {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    return preferencesOf(user?.preferences);
  }

  async update(
    userId: string,
    patch: { defaultSoundSkin?: string },
  ): Promise<UserPreferences> {
    const prefs = await this.get(userId);
    if (patch.defaultSoundSkin !== undefined) {
      const s = patch.defaultSoundSkin.trim();
      if (!s || s.length > 64 || s === "default") {
        throw new BadRequestException("Invalid audio skin");
      }
      prefs.defaultSoundSkin = s;
    }
    await this.prisma.db.user.update({
      where: { id: userId },
      data: { preferences: prefs },
    });
    return prefs;
  }
}
