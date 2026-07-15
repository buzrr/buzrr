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

// ARGV: [1]=sessionId (HSETNX guard value), [2]=TTL, [3..]=flattened meta pairs.
const INIT_META_SCRIPT = `
local created = redis.call('HSETNX', KEYS[1], 'sessionId', ARGV[1])
if created == 1 then
  redis.call('HSET', KEYS[1], unpack(ARGV, 3))
  redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return created
`;

// Renews the owner TTL only if it's still held by the calling instance.
const RENEW_OWNER_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  return 1
end
return 0
`;

// Claims the ended-game transition so only one caller persists the result.
const CLAIM_ENDED_SCRIPT = `
local phase = redis.call('HGET', KEYS[1], 'phase')
if phase == 'ended' or phase == false then
  return 0
end
redis.call('HSET', KEYS[1], 'phase', 'ended', 'qDeadline', '0')
redis.call('EXPIRE', KEYS[1], ARGV[1])
return 1
`;

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
    const flat = this.flattenMeta(patch);
    if (flat.length === 0) return;
    const record: Record<string, string> = {};
    for (let i = 0; i < flat.length; i += 2) {
      record[flat[i]] = flat[i + 1];
    }
    await this.redis
      .multi()
      .hset(keys.meta(code), record)
      .expire(keys.meta(code), TTL_SECONDS)
      .exec();
  }

  /** Create the meta record if it does not exist yet. Returns true if created. */
  async initMeta(code: string, meta: GameMeta): Promise<boolean> {
    const flat = this.flattenMeta(meta);
    const created = await this.redis.eval(
      INIT_META_SCRIPT,
      1,
      keys.meta(code),
      meta.sessionId,
      TTL_SECONDS,
      ...flat,
    );
    return created === 1;
  }

  /**
   * Atomically transitions phase to "ended". Returns false if another caller
   * already claimed it (or the game is gone), so only one claimant persists
   * the result and cleans up.
   */
  async claimEnded(code: string): Promise<boolean> {
    const claimed = await this.redis.eval(
      CLAIM_ENDED_SCRIPT,
      1,
      keys.meta(code),
      TTL_SECONDS,
    );
    return claimed === 1;
  }

  private flattenMeta(patch: Partial<GameMeta>): string[] {
    const flat: string[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      flat.push(k, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
    }
    return flat;
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
    const [[, set]] = (await this.redis
      .multi()
      .hsetnx(key, playerId, JSON.stringify(answer))
      .expire(key, TTL_SECONDS)
      .exec()) as [[Error | null, number]];
    return set === 1;
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
  async leaderboard(
    code: string,
  ): Promise<{ playerId: string; score: number }[]> {
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

  /**
   * Keeps the game visible to the sweeper (host-abandon checks) through
   * host-paced phases that have no auto-advance deadline. The far-future
   * score only comes due at the TTL horizon, by which time the meta has
   * expired and handleDeadline clears the entry.
   */
  async parkDeadline(code: string): Promise<void> {
    await this.redis.zadd(
      keys.deadlines(),
      Date.now() + TTL_SECONDS * 1000,
      code,
    );
  }

  async allDeadlines(): Promise<{ code: string; atMs: number }[]> {
    const flat = await this.redis.zrange(keys.deadlines(), 0, -1, "WITHSCORES");
    const out: { code: string; atMs: number }[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      out.push({ code: flat[i], atMs: Number(flat[i + 1]) });
    }
    return out;
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
    const renewed = await this.redis.eval(
      RENEW_OWNER_SCRIPT,
      1,
      keys.owner(code),
      instanceId,
      20_000,
    );
    return renewed === 1;
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
