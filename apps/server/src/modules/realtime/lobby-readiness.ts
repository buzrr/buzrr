import type { LobbyReadyPayload } from "@buzrr/contract";

/** A device that sent nothing this long isn't waited for (left, locked phone). */
export const ASSETS_QUIET_MS = 8_000;
/** The host may start anyway this long after the last join or the first try. */
export const FORCE_START_AFTER_MS = 30_000;

interface Device {
  done: boolean;
  /** Last sign of life: joining, or a progress report. */
  at: number;
}

interface Room {
  devices: Map<string, Device>;
  lastJoinAt: number;
  /** When the host first pressed start while devices were downloading. */
  firstTryAt: number;
}

/**
 * Which players in a lobby have downloaded everything (`preload-all`), and
 * whether the host may start: when every connected player is ready, else
 * FORCE_START_AFTER_MS after the last join (or the first start attempt,
 * whichever is earlier). Quiet devices don't hold anyone up. In memory per
 * server process.
 */
export class LobbyReadiness {
  private rooms = new Map<string, Room>();

  private room(game: string): Room {
    let r = this.rooms.get(game);
    if (!r) {
      r = { devices: new Map(), lastJoinAt: 0, firstTryAt: 0 };
      this.rooms.set(game, r);
    }
    return r;
  }

  /** A player connected (it starts downloading). */
  joined(game: string, playerId: string, now: number): void {
    const r = this.room(game);
    const known = r.devices.get(playerId);
    r.devices.set(playerId, { done: known?.done ?? false, at: now });
    r.lastJoinAt = now;
  }

  /** Progress from a device; `done` covers files given up on too. */
  report(game: string, playerId: string, done: boolean, now: number): void {
    const r = this.room(game);
    const d = r.devices.get(playerId);
    r.devices.set(playerId, { done: done || Boolean(d?.done), at: now });
  }

  left(game: string, playerId: string): void {
    this.rooms.get(game)?.devices.delete(playerId);
  }

  /** The counts for `connected` players (ids). */
  status(game: string, connected: string[], now: number): LobbyReadyPayload {
    const r = this.room(game);
    let ready = 0;
    let pending = 0;
    for (const id of connected) {
      const d = r.devices.get(id);
      if (d?.done) ready++;
      else if (d && now - d.at < ASSETS_QUIET_MS) pending++;
    }
    const since = Math.min(r.lastJoinAt || Infinity, r.firstTryAt || Infinity);
    const forceAt =
      pending === 0 || since === Infinity ? 0 : since + FORCE_START_AFTER_MS;
    return { ready, total: connected.length, pending, forceAt };
  }

  /** The host pressed start: may it go now? Remembers the first try. */
  mayStart(game: string, connected: string[], now: number): boolean {
    const r = this.room(game);
    const s = this.status(game, connected, now);
    if (s.pending === 0) return true;
    if (!r.firstTryAt) r.firstTryAt = now;
    return now >= this.status(game, connected, now).forceAt;
  }

  forget(game: string): void {
    this.rooms.delete(game);
  }
}
