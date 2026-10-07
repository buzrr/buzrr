import type { GameMeta, PacingMode } from "../game-engine.types";

/**
 * How a game moves forward once a question has been revealed. The phase
 * machine (`machine.ts`) asks the game's strategy at each fork instead of
 * branching on game mode, so a new way of pacing a game is a new strategy —
 * not edits scattered through the engine.
 *
 * Every strategy shares the parts that make a question fair: the server-timed
 * answer window, and the early close once every connected player has
 * answered. What varies is who advances past the reveal and what the final
 * leaderboard means.
 *
 * A self-paced mode (each player moving through the quiz on their own clock)
 * slots in here too, but needs per-player question state the shared phase
 * machine doesn't model yet; see docs/architecture/realtime.md § Pacing.
 */
export interface PacingStrategy {
  readonly mode: PacingMode;
  /** Whether the host's `host-next` intent may advance the game. */
  readonly hostControlled: boolean;
  /**
   * When the reveal advances on its own, or null to wait for the host. A
   * reveal with no deadline is parked so the abandon sweep still sees it.
   */
  revealEndsAt(now: number): number | null;
  /** True when reaching the final leaderboard also ends the game. */
  readonly endsOnFinal: boolean;
}

/** Auto-advance delay after a reveal in hostless games. */
export const AUTO_REVEAL_MS = 4_000;

/** Classic rooms: the host decides when each reveal is over. */
export const hostPaced: PacingStrategy = {
  mode: "host",
  hostControlled: true,
  revealEndsAt: () => null,
  endsOnFinal: false,
};

/** Duels: nobody hosts, so the reveal times out and the game ends itself. */
export const autoAdvance: PacingStrategy = {
  mode: "auto",
  hostControlled: false,
  revealEndsAt: (now) => now + AUTO_REVEAL_MS,
  endsOnFinal: true,
};

const STRATEGIES: Record<PacingMode, PacingStrategy> = {
  host: hostPaced,
  auto: autoAdvance,
};

/**
 * The game's strategy. Games created before `pacing` was stored fall back to
 * what their mode always implied.
 */
export function pacingFor(
  meta: Pick<GameMeta, "mode" | "pacing">,
): PacingStrategy {
  const mode = meta.pacing ?? (meta.mode === "duel" ? "auto" : "host");
  return STRATEGIES[mode] ?? hostPaced;
}
