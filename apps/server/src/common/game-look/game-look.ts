import {
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

/**
 * How a quiz looks in a game, with the owner's defaults filled in: "default"
 * audio / avatar skins resolved, the logo falling back to the owner's default
 * logo, and the avatars players pick from.
 */
export function resolveGameLook(
  quiz: { settings: unknown; logo: string | null },
  ownerPreferences: unknown,
): { settings: QuizSettings; logo: string | null; avatars: string[] } {
  const prefs = preferencesOf(ownerPreferences);
  const parsed = quizSettingsSchema.safeParse(quiz.settings ?? {});
  const settings = parsed.success ? parsed.data : quizSettingsSchema.parse({});
  const sound = {
    ...settings.sound,
    skin:
      settings.sound.skin === "default"
        ? prefs.defaultSoundSkin
        : settings.sound.skin,
  };
  const avatarSkin =
    settings.avatarSkin === "default"
      ? prefs.defaultAvatarSkin
      : settings.avatarSkin;
  const avatars =
    avatarSkin === "custom"
      ? prefs.customAvatars.length > 0
        ? prefs.customAvatars
        : BUILTIN_AVATARS.original
      : BUILTIN_AVATARS[avatarSkin];
  return {
    settings: { ...settings, sound, avatarSkin },
    logo: quiz.logo ?? prefs.defaultLogo,
    avatars,
  };
}

/** A stable pick from `avatars` for this player (same room, same picture). */
export function assignAvatar(avatars: string[], playerId: string): string {
  let h = 0;
  for (const ch of playerId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return avatars[h % avatars.length]!;
}
