import { REACTION_WINDOW_MS } from "@buzrr/contract";

/**
 * Live reactions per player and room: at most `limit` within
 * REACTION_WINDOW_MS (a sliding window). Per player, not per socket, so a
 * reconnect doesn't hand out a new budget; `reset` starts a room afresh
 * (every question, the final standings). In memory per server process.
 */
export class ReactionBudgets {
  private rooms = new Map<string, Map<string, number[]>>();

  /** Counts the reaction if the budget allows; otherwise how long to wait. */
  take(
    game: string,
    playerId: string,
    limit: number,
    now: number,
  ): { ok: true } | { ok: false; retryInMs: number } {
    let room = this.rooms.get(game);
    if (!room) {
      room = new Map();
      this.rooms.set(game, room);
    }
    const sent = (room.get(playerId) ?? []).filter(
      (at) => now - at < REACTION_WINDOW_MS,
    );
    if (sent.length >= limit) {
      room.set(playerId, sent);
      return { ok: false, retryInMs: REACTION_WINDOW_MS - (now - sent[0]!) };
    }
    sent.push(now);
    room.set(playerId, sent);
    return { ok: true };
  }

  reset(game: string): void {
    this.rooms.delete(game);
  }
}
