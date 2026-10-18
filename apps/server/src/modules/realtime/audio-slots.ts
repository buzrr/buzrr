/**
 * Download slots for question sound clips, per room: at most `limit` devices
 * download at the same time, the rest queue and get `preload-go` as slots
 * free up (a device reports done, leaves, or stalls). A full room fetching
 * its clips in the same second made requests time out; rationed, each one
 * gets the bandwidth to finish.
 *
 * In memory, per server process — the room's sockets all live on one.
 */

/** A slot whose device sent no progress this long is given to the next one. */
export const SLOT_STALL_MS = 8_000;

interface Holder {
  socketId: string;
  at: number;
}

interface RoomSlots {
  qIndex: number;
  active: Map<string, Holder>;
  queue: { id: string; socketId: string }[];
}

/** A queued device whose turn has come: send it `preload-go`. */
export interface Grant {
  socketId: string;
  qIndex: number;
}

export class AudioSlots {
  private rooms = new Map<string, RoomSlots>();

  /** `limit` 0 = unlimited (every request is granted at once). */
  constructor(readonly limit: number) {}

  get limited(): boolean {
    return this.limit > 0;
  }

  /**
   * Device `id` wants to download question `qIndex`'s clips. True = go now;
   * false = queued, a `Grant` for it comes from a later call. The host
   * ("host") never queues: its screen plays the sound for the whole room.
   */
  request(
    game: string,
    qIndex: number,
    id: string,
    socketId: string,
    now: number,
  ): boolean {
    if (!this.limited || id === "host") return true;
    const room = this.room(game, qIndex);
    const held = room.active.get(id);
    if (held) {
      held.socketId = socketId;
      held.at = now;
      return true;
    }
    room.queue = room.queue.filter((q) => q.id !== id);
    if (room.active.size < this.limit) {
      room.active.set(id, { socketId, at: now });
      return true;
    }
    room.queue.push({ id, socketId });
    return false;
  }

  /** Download progress from `id`: its slot is still in use. */
  touch(game: string, qIndex: number, id: string, now: number): void {
    const room = this.rooms.get(game);
    const held = room?.qIndex === qIndex ? room.active.get(id) : undefined;
    if (held) held.at = now;
  }

  /** `id` finished (or gave up) question `qIndex`'s download. */
  release(game: string, qIndex: number, id: string, now: number): Grant[] {
    const room = this.rooms.get(game);
    if (!room || room.qIndex !== qIndex) return [];
    room.active.delete(id);
    return this.fill(game, room, now);
  }

  /** `id`'s socket went away: its slot or queue place too. */
  leave(game: string, id: string, socketId: string, now: number): Grant[] {
    const room = this.rooms.get(game);
    if (!room) return [];
    if (room.active.get(id)?.socketId === socketId) room.active.delete(id);
    room.queue = room.queue.filter((q) => q.socketId !== socketId);
    return this.fill(game, room, now);
  }

  /** Frees slots that stopped moving; returns who moves up (all rooms). */
  sweep(now: number): Grant[] {
    const grants: Grant[] = [];
    for (const [game, room] of this.rooms) {
      for (const [id, h] of room.active) {
        if (now - h.at >= SLOT_STALL_MS) room.active.delete(id);
      }
      grants.push(...this.fill(game, room, now));
    }
    return grants;
  }

  /** Drop a finished room. */
  forget(game: string): void {
    this.rooms.delete(game);
  }

  private room(game: string, qIndex: number): RoomSlots {
    let room = this.rooms.get(game);
    // The next question's preload starts a fresh round.
    if (!room || room.qIndex !== qIndex) {
      room = { qIndex, active: new Map(), queue: [] };
      this.rooms.set(game, room);
    }
    return room;
  }

  private fill(game: string, room: RoomSlots, now: number): Grant[] {
    const grants: Grant[] = [];
    while (room.active.size < this.limit && room.queue.length > 0) {
      const next = room.queue.shift()!;
      room.active.set(next.id, { socketId: next.socketId, at: now });
      grants.push({ socketId: next.socketId, qIndex: room.qIndex });
    }
    if (room.active.size === 0 && room.queue.length === 0) {
      this.rooms.delete(game);
    }
    return grants;
  }
}
