import { questionAnswerSchema, type QuestionAnswer } from "@buzrr/contract";
import { ANSWER_GRACE_MS } from "../../../common/utils/answer-timing";
import type { GameMeta, RosterEntry } from "../game-engine.types";
import { pacingFor } from "./pacing";

// Pure decisions behind the presence paths — pause/resume, forfeits and the
// abandon sweep. The atomic claims themselves stay in the shell (they are
// Lua compare-and-sets against Redis); these only decide what to claim.

/** A host-paced game whose host has been gone this long is ended. */
export const HOST_ABANDON_MS = 5 * 60_000;
/** A duel player disconnected this long mid-game forfeits the match. */
export const DUEL_FORFEIT_MS = 30_000;

/**
 * Where a paused duel's timestamps move to on resume: every one shifts by the
 * paused span, so the returning player keeps the time they had left, their
 * score decays from the same point, and the bot's answer keeps its place.
 *
 * `fireAt` is when the resumed game's next deadline is due (null: nothing to
 * schedule). A question paused before its window was stamped fires at once so
 * the deadline handler re-opens it.
 */
export function resumePlan(
  meta: GameMeta,
  now: number,
): { patch: Partial<GameMeta>; fireAt: number | null; pausedFor: number } {
  const pausedFor = Math.max(0, now - (meta.pausedAt ?? now));
  const patch: Partial<GameMeta> = {};
  if (meta.qDeadline > 0) patch.qDeadline = meta.qDeadline + pausedFor;
  if (meta.phase === "question" && meta.qStartAt) {
    patch.qStartAt = meta.qStartAt + pausedFor;
    if (meta.botAnswerAt) patch.botAnswerAt = meta.botAnswerAt + pausedFor;
  }

  let fireAt: number | null = null;
  if (patch.qDeadline) {
    fireAt =
      meta.phase === "question"
        ? patch.qDeadline + ANSWER_GRACE_MS
        : patch.qDeadline;
  } else if (meta.phase === "question") {
    fireAt = now;
  }
  return { patch, fireAt, pausedFor };
}

/** Only an in-flight duel can be paused. */
export function canPause(meta: GameMeta): boolean {
  return (
    !meta.pausedAt && ["starting", "question", "reveal"].includes(meta.phase)
  );
}

/**
 * Bots sit in the roster permanently "connected" (they have no socket), so
 * they never count as someone the match is still being played for.
 */
export function hasConnectedHuman(
  meta: GameMeta,
  roster: RosterEntry[],
): boolean {
  return roster.some((p) => p.connected && p.id !== meta.botId);
}

/** A rostered human who has been disconnected past the forfeit grace. */
export function overdueForfeiter(
  meta: GameMeta,
  roster: RosterEntry[],
  now: number,
): RosterEntry | undefined {
  return roster.find(
    (p) =>
      p.id !== meta.botId &&
      !p.connected &&
      now - p.lastSeenAt > DUEL_FORFEIT_MS,
  );
}

/**
 * How a duel ends when `playerId` stays gone: a forfeit if their opponent is
 * still there, abandoned if both left. Null when the player is back (or was
 * never in the game).
 */
export function forfeitOutcome(
  roster: RosterEntry[],
  playerId: string,
): { forfeitLoserId: string } | { abandoned: true } | null {
  const player = roster.find((p) => p.id === playerId);
  if (!player || player.connected) return null;
  const opponent = roster.find((p) => p.id !== playerId);
  return opponent?.connected
    ? { forfeitLoserId: player.userId ?? playerId }
    : { abandoned: true };
}

/** A host-paced game the host walked away from (never a lobby). */
export function isHostAbandoned(meta: GameMeta, now: number): boolean {
  return (
    pacingFor(meta).hostControlled &&
    !meta.hostConnected &&
    meta.phase !== "lobby" &&
    meta.phase !== "ended" &&
    now - meta.hostLastSeenAt > HOST_ABANDON_MS
  );
}

/**
 * The bot's committed answer for the open question. Games planned before
 * answers were type-agnostic stored only the option id.
 */
export function botAnswerOf(meta: GameMeta): QuestionAnswer | null {
  if (meta.botAnswer) {
    try {
      const parsed = questionAnswerSchema.safeParse(JSON.parse(meta.botAnswer));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
  return meta.botOptionId ? { optionId: meta.botOptionId } : null;
}
