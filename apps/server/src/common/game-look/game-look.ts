import {
  BUILTIN_SOUND_SKINS,
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
 * How a quiz sounds in a game, with the owner's defaults filled in: the
 * "default" audio skin resolved.
 */
export function resolveGameLook(
  quiz: { settings: unknown },
  ownerPreferences: unknown,
  /**
   * The host has Pro (or the instance runs without billing): own audio
   * skins. Without, the built-in ones play.
   */
  pro = true,
): { settings: QuizSettings } {
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
  return { settings: { ...settings, sound } };
}
