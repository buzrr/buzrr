import { quizSettingsSchema, type QuizSettings } from "@buzrr/contract";

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
