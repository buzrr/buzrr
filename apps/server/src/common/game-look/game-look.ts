import type { PrismaService } from "../../prisma/prisma.service";
import {
  BUILTIN_SOUND_SKINS,
  BUILTIN_AVATARS,
  quizSettingsSchema,
  userPreferencesSchema,
  type QuizSettings,
  type UserPreferences,
} from "@buzrr/contract";

/** A user's stored preferences, with defaults for anything missing. */
export function preferencesOf(raw: unknown): UserPreferences {
  const parsed = userPreferencesSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : userPreferencesSchema.parse({});
}

/** Stored settings with defaults for anything missing; invalid → defaults. */
function settingsOf(raw: unknown): QuizSettings {
  const parsed = quizSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : quizSettingsSchema.parse({});
}

/**
 * A room's settings: the game's own (`GameSession.settings`, chosen in the
 * "Host quiz" dialog) when it has them, else the quiz's. Every read for a
 * live room goes through here.
 */
export function roomSettings(session: {
  settings: unknown;
  quiz: { settings: unknown };
}): QuizSettings {
  return settingsOf(session.settings ?? session.quiz.settings);
}

/**
 * How a quiz looks in a game, with the owner's defaults filled in: "default"
 * audio / avatar skins resolved, the logo falling back to the owner's default
 * logo, and the avatars players pick from.
 */
export function resolveGameLook(
  quiz: { settings: unknown; logo: string | null },
  ownerPreferences: unknown,
  /**
   * The host has Pro (or the instance runs without billing): own audio
   * skins, own avatars and logos. Without, the built-in ones play.
   */
  pro = true,
  /** The superadmin's shared avatar skin ("shared"); empty: not shared. */
  shared: string[] = [],
): { settings: QuizSettings; logo: string | null; avatars: string[] } {
  const prefs = preferencesOf(ownerPreferences);
  const settings = settingsOf(quiz.settings);
  const chosenSkin =
    settings.sound.skin === "default"
      ? prefs.defaultSoundSkin
      : settings.sound.skin;
  const sound = {
    ...settings.sound,
    skin:
      pro || (BUILTIN_SOUND_SKINS as readonly string[]).includes(chosenSkin)
        ? chosenSkin
        : BUILTIN_SOUND_SKINS[0],
  };
  const chosenAvatars =
    settings.avatarSkin === "default"
      ? prefs.defaultAvatarSkin
      : settings.avatarSkin;
  const avatarSkin =
    !pro && chosenAvatars === "custom" ? "original" : chosenAvatars;
  const avatars =
    avatarSkin === "custom"
      ? prefs.customAvatars.length > 0
        ? prefs.customAvatars
        : BUILTIN_AVATARS.original
      : avatarSkin === "shared"
        ? shared.length > 0
          ? shared
          : BUILTIN_AVATARS.original
        : BUILTIN_AVATARS[avatarSkin];
  return {
    settings: { ...settings, sound, avatarSkin },
    logo: pro ? (quiz.logo ?? prefs.defaultLogo) : null,
    avatars,
  };
}

/** A stable pick from `avatars` for this player (same room, same picture). */
export function assignAvatar(avatars: string[], playerId: string): string {
  let h = 0;
  for (const ch of playerId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return avatars[h % avatars.length]!;
}

/**
 * The avatar skin the superadmin shares with everyone ("shared"): their own
 * pictures, if they switched sharing on. Empty otherwise.
 */
export async function loadSharedAvatars(
  db: PrismaService["db"],
): Promise<string[]> {
  const admin = await db.user.findFirst({
    where: { role: "superadmin" },
    select: { preferences: true },
    orderBy: { createdAt: "asc" },
  });
  const prefs = preferencesOf(admin?.preferences);
  return prefs.shareCustomAvatars ? prefs.customAvatars : [];
}
