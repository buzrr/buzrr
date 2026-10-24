import {
  moderationSettingsSchema,
  type ModerationSettings,
} from "@buzrr/contract";
import type { GameMeta } from "../game-engine.types";

/**
 * The game's moderated-mode settings, or null for an unmoderated game. Stored
 * in meta as JSON at start (from the room's settings: the game's own, else
 * `Quiz.settings`); only classic rooms can be moderated.
 */
export function moderationOf(
  meta: Pick<GameMeta, "mode" | "moderation">,
): ModerationSettings | null {
  if (meta.mode !== "classic" || !meta.moderation) return null;
  try {
    const parsed = moderationSettingsSchema.safeParse(
      JSON.parse(meta.moderation),
    );
    return parsed.success && parsed.data.enabled ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Whether the reveal is followed by a separate "scores" step the host
 * triggers — so the reveal itself must not show the standings yet.
 */
export function scoresStepPending(mod: ModerationSettings | null): boolean {
  return Boolean(mod?.showScores && mod.confirmShowScores);
}

/**
 * Whether the running leaderboard goes out together with the reveal. Not
 * after a moderated game's last question: the final standings come next and
 * show it first.
 */
export function leaderboardWithReveal(
  mod: ModerationSettings | null,
  lastQuestion = false,
): boolean {
  return (
    mod === null || (mod.showScores && !mod.confirmShowScores && !lastQuestion)
  );
}
