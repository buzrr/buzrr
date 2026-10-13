import { vi } from "vitest";
import type { SocketData } from "../../realtime/realtime.types";
import { question } from "../core/__tests__/fixtures";
import type { GameState, StatePart } from "../core/state";
import type { GameMeta, RosterEntry, StoredAnswer } from "../game-engine.types";

// An in-memory GameStoreService and a fake Socket.IO server, for specs that
// drive the engine shell without Redis.

export const CODE = "ROOM01";

export class MemoryStore {
  meta: GameMeta;
  players = new Map<string, RosterEntry>();
  answers = new Map<number, Map<string, StoredAnswer>>();
  scores = new Map<string, number>();

  constructor(
    m: GameMeta,
    players: RosterEntry[],
    readonly questions: GameState["questions"] = [
      question("q0"),
      question("q1"),
    ],
  ) {
    this.meta = m;
    for (const p of players) this.players.set(p.id, p);
  }

  async getMeta() {
    return { ...this.meta };
  }
  async patchMeta(_code: string, patch: Partial<GameMeta>) {
    this.meta = { ...this.meta, ...patch };
  }
  async loadState(
    _code: string,
    _parts: readonly StatePart[],
    qIndex?: number,
  ): Promise<GameState> {
    return {
      meta: { ...this.meta },
      questions: this.questions,
      roster: [...this.players.values()],
      answers: Object.fromEntries(
        this.answers.get(qIndex ?? this.meta.qIndex) ?? [],
      ),
      scores: [...this.scores].map(([playerId, score]) => ({
        playerId,
        score,
      })),
    };
  }
  async getPlayer(_code: string, id: string) {
    return this.players.get(id) ?? null;
  }
  async upsertPlayer(_code: string, entry: RosterEntry) {
    this.players.set(entry.id, entry);
  }
  async roster() {
    return [...this.players.values()];
  }
  async recordAnswer(
    _code: string,
    qIndex: number,
    playerId: string,
    answer: StoredAnswer,
  ) {
    const forQuestion = this.answers.get(qIndex) ?? new Map();
    this.answers.set(qIndex, forQuestion);
    if (forQuestion.has(playerId)) return null;
    forQuestion.set(playerId, answer);
    this.scores.set(playerId, (this.scores.get(playerId) ?? 0) + answer.score);
    return [...forQuestion.keys()];
  }
  async getAnswerRaw(_code: string, qIndex: number, playerId: string) {
    const stored = this.answers.get(qIndex)?.get(playerId);
    return stored ? JSON.stringify(stored) : null;
  }
  async replaceAnswer(
    _code: string,
    qIndex: number,
    playerId: string,
    previousRaw: string,
    next: StoredAnswer,
  ) {
    const forQuestion = this.answers.get(qIndex);
    if (JSON.stringify(forQuestion?.get(playerId)) !== previousRaw) {
      return false;
    }
    forQuestion!.set(playerId, next);
    return true;
  }
  async setDeadline() {}
  async parkDeadline() {}
  async clearDeadline() {}
  async ensureOwner() {
    return true;
  }
}

/**
 * Rooms hold the sockets the real server would still have *after* the
 * closing socket left them (Socket.IO leaves rooms before `disconnect`).
 */
export class FakeServer {
  rooms = new Map<string, Partial<SocketData>[]>();
  emitted: { room: string; event: string; payload: unknown }[] = [];
  fetchSockets = vi.fn(async (room: string) =>
    (this.rooms.get(room) ?? []).map((data) => ({ data })),
  );

  in(room: string) {
    return { fetchSockets: () => this.fetchSockets(room) };
  }
  to(room: string) {
    return {
      emit: (event: string, payload: unknown) => {
        this.emitted.push({ room, event, payload });
      },
    };
  }
  events(event: string) {
    return this.emitted.filter((e) => e.event === event);
  }
}
