import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS } from "../../redis/redis.constants";
import {
  GameMeta,
  LiveQuestion,
  RosterEntry,
  StoredAnswer,
} from "./game-engine.types";

const TTL_SECONDS = 6 * 60 * 60;

const keys = {
  meta: (c: string) => `game:${c}:meta`,
  questions: (c: string) => `game:${c}:questions`,
  answers: (c: string, q: number) => `game:${c}:answers:${q}`,
  lb: (c: string) => `game:${c}:lb`,
  players: (c: string) => `game:${c}:players`,
  owner: (c: string) => `game:${c}:owner`,
  deadlines: () => `games:deadlines`,
};

const NUMERIC_META = new Set([
  "qIndex",
  "qStartAt",
  "qDeadline",
  "qCount",
  "startedAt",
  "hostLastSeenAt",
]);
const BOOLEAN_META = new Set(["hostConnected"]);

/**
 * Redis access layer for live game sessions. All state that changes during a
 * running game lives here; Postgres only sees the lobby record and (later)
 * final results.
 */
@Injectable()
export class GameStoreService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  // -- meta ----------------------------------------------------------------

  async getMeta(code: string): Promise<GameMeta | null> {
    const raw = await this.redis.hgetall(keys.meta(code));
    if (!raw || Object.keys(raw).length === 0) return null;
    const meta: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (NUMERIC_META.has(k)) meta[k] = Number(v);
      else if (BOOLEAN_META.has(k)) meta[k] = v === "1";
      else meta[k] = v;
    }
    return meta as unknown as GameMeta;
  }

  async patchMeta(code: string, patch: Partial<GameMeta>): Promise<void> {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      if (typeof v === "boolean") flat[k] = v ? "1" : "0";
      else flat[k] = String(v);
    }
    if (Object.keys(flat).length === 0) return;
    await this.redis
      .multi()
      .hset(keys.meta(code), flat)
      .expire(keys.meta(code), TTL_SECONDS)
      .exec();
  }

  /** Create the meta record if it does not exist yet. Returns true if created. */
  async initMeta(code: string, meta: GameMeta): Promise<boolean> {
    const created = await this.redis.hsetnx(
      keys.meta(code),
      "sessionId",
      meta.sessionId,
    );
    if (created === 1) {
      await this.patchMeta(code, meta);
      return true;
    }
    return false;
  }

  // -- questions -----------------------------------------------------------

  async setQuestions(code: string, questions: LiveQuestion[]): Promise<void> {
    await this.redis.set(
      keys.questions(code),
      JSON.stringify(questions),
      "EX",
      TTL_SECONDS,
    );
  }

  async getQuestions(code: string): Promise<LiveQuestion[] | null> {
    const raw = await this.redis.get(keys.questions(code));
    return raw ? (JSON.parse(raw) as LiveQuestion[]) : null;
  }

  // -- answers -------------------------------------------------------------

  /** First answer wins. Returns false if the player already answered. */
  async putAnswer(
    code: string,
    qIndex: number,
    playerId: string,
    answer: StoredAnswer,
  ): Promise<boolean> {
    const key = keys.answers(code, qIndex);
    const set = await this.redis.hsetnx(key, playerId, JSON.stringify(answer));
    if (set === 1) {
      await this.redis.expire(key, TTL_SECONDS);
      return true;
    }
    return false;
  }

  async getAnswers(
    code: string,
    qIndex: number,
  ): Promise<Record<string, StoredAnswer>> {
    const raw = await this.redis.hgetall(keys.answers(code, qIndex));
    const out: Record<string, StoredAnswer> = {};
    for (const [playerId, json] of Object.entries(raw ?? {})) {
      out[playerId] = JSON.parse(json) as StoredAnswer;
    }
    return out;
  }

  async answerCount(code: string, qIndex: number): Promise<number> {
    return this.redis.hlen(keys.answers(code, qIndex));
  }

  // -- leaderboard ---------------------------------------------------------

  async addScore(code: string, playerId: string, delta: number): Promise<void> {
    await this.redis
      .multi()
      .zincrby(keys.lb(code), delta, playerId)
      .expire(keys.lb(code), TTL_SECONDS)
      .exec();
  }

  async totalScore(code: string, playerId: string): Promise<number> {
    const score = await this.redis.zscore(keys.lb(code), playerId);
    return score ? Number(score) : 0;
  }

  /** 1-based rank by descending score; null when the player has no score yet. */
  async rank(code: string, playerId: string): Promise<number | null> {
    const r = await this.redis.zrevrank(keys.lb(code), playerId);
    return r === null ? null : r + 1;
  }

  /** playerId → score, descending. */
  async leaderboard(code: string): Promise<{ playerId: string; score: number }[]> {
    const flat = await this.redis.zrevrange(keys.lb(code), 0, -1, "WITHSCORES");
    const out: { playerId: string; score: number }[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      out.push({ playerId: flat[i], score: Number(flat[i + 1]) });
    }
    return out;
  }

  // -- roster ----------------------------------------------------------------

  async upsertPlayer(code: string, entry: RosterEntry): Promise<void> {
    await this.redis
      .multi()
      .hset(keys.players(code), entry.id, JSON.stringify(entry))
      .expire(keys.players(code), TTL_SECONDS)
      .exec();
  }

  async getPlayer(code: string, playerId: string): Promise<RosterEntry | null> {
    const raw = await this.redis.hget(keys.players(code), playerId);
    return raw ? (JSON.parse(raw) as RosterEntry) : null;
  }

  async removePlayer(code: string, playerId: string): Promise<void> {
    await this.redis.hdel(keys.players(code), playerId);
  }

  async roster(code: string): Promise<RosterEntry[]> {
    const raw = await this.redis.hgetall(keys.players(code));
    return Object.values(raw ?? {}).map((v) => JSON.parse(v) as RosterEntry);
  }

  // -- deadlines / recovery --------------------------------------------------

  async setDeadline(code: string, atMs: number): Promise<void> {
    await this.redis.zadd(keys.deadlines(), atMs, code);
  }

  async clearDeadline(code: string): Promise<void> {
    await this.redis.zrem(keys.deadlines(), code);
  }

  async allDeadlines(): Promise<{ code: string; atMs: number }[]> {
    const flat = await this.redis.zrange(keys.deadlines(), 0, -1, "WITHSCORES");
    const out: { code: string; atMs: number }[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      out.push({ code: flat[i], atMs: Number(flat[i + 1]) });
    }
    return out;
  }

  async dueDeadlines(nowMs: number): Promise<string[]> {
    return this.redis.zrangebyscore(keys.deadlines(), 0, nowMs);
  }

  // -- ownership ---------------------------------------------------------------

  /**
   * Timer ownership so only one instance fires transitions for a game.
   * Returns true if this instance owns (or just acquired) the game.
   */
  async ensureOwner(code: string, instanceId: string): Promise<boolean> {
    const acquired = await this.redis.set(
      keys.owner(code),
      instanceId,
      "PX",
      20_000,
      "NX",
    );
    if (acquired === "OK") return true;
    const current = await this.redis.get(keys.owner(code));
    if (current === instanceId) {
      await this.redis.pexpire(keys.owner(code), 20_000);
      return true;
    }
    return false;
  }

  // -- cleanup -------------------------------------------------------------------

  async deleteGame(code: string, qCount: number): Promise<void> {
    const toDelete = [
      keys.meta(code),
      keys.questions(code),
      keys.lb(code),
      keys.players(code),
      keys.owner(code),
    ];
    for (let i = 0; i < Math.max(qCount, 1); i++) {
      toDelete.push(keys.answers(code, i));
    }
    await this.redis
      .multi()
      .del(...toDelete)
      .zrem(keys.deadlines(), code)
      .exec();
  }
}
