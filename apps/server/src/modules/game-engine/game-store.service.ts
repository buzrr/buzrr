import { Inject, Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { REDIS } from "../../redis/redis.constants";
import { normalizeLiveQuestion } from "../question-types";
import type { GameState, StatePart } from "./core/state";
import {
  GameMeta,
  LiveQuestion,
  PreloadStatus,
  RosterEntry,
  ScoreEntry,
  StoredAnswer,
} from "./game-engine.types";

const TTL_SECONDS = 6 * 60 * 60;

const keys = {
  meta: (c: string) => `game:${c}:meta`,
  questions: (c: string) => `game:${c}:questions`,
  answers: (c: string, q: number) => `game:${c}:answers:${q}`,
  lb: (c: string) => `game:${c}:lb`,
  players: (c: string) => `game:${c}:players`,
  banned: (c: string) => `game:${c}:banned`,
  owner: (c: string) => `game:${c}:owner`,
  preloads: (c: string, q: number) => `game:${c}:preloads:${q}`,
  deadlines: () => `games:deadlines`,
};

const NUMERIC_META = new Set([
  "qIndex",
  "qStartAt",
  "qDeadline",
  "qCount",
  "startedAt",
  "hostLastSeenAt",
  "botElo",
  "botAnswerAt",
  "pausedAt",
  "preloadWaitSince",
]);
const BOOLEAN_META = new Set(["hostConnected", "rated"]);

function parsePreloads(
  raw: Record<string, string> | null,
): Record<string, PreloadStatus> {
  const out: Record<string, PreloadStatus> = {};
  for (const [id, json] of Object.entries(raw ?? {})) {
    try {
      out[id] = JSON.parse(json) as PreloadStatus;
    } catch {
      // ignore a broken entry
    }
  }
  return out;
}

function parseMeta(raw: Record<string, string>): GameMeta | null {
  if (!raw || Object.keys(raw).length === 0) return null;
  const meta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (NUMERIC_META.has(k)) meta[k] = Number(v);
    else if (BOOLEAN_META.has(k)) meta[k] = v === "1";
    else meta[k] = v;
  }
  return meta as unknown as GameMeta;
}

function parseQuestions(raw: string | null): LiveQuestion[] | null {
  if (!raw) return null;
  return (JSON.parse(raw) as Parameters<typeof normalizeLiveQuestion>[0][]).map(
    normalizeLiveQuestion,
  );
}

/**
 * Answers stored before answers were type-agnostic carried a bare
 * `optionId`; a deploy mid-game reads them as multiple-choice answers.
 */
export function parseAnswer(json: string): StoredAnswer {
  const stored = JSON.parse(json) as StoredAnswer & { optionId?: string };
  if (stored.answer === undefined && stored.optionId !== undefined) {
    const { optionId, ...rest } = stored;
    return { ...rest, answer: { optionId } };
  }
  return stored;
}

function parseAnswers(
  raw: Record<string, string> | null,
): Record<string, StoredAnswer> {
  const out: Record<string, StoredAnswer> = {};
  for (const [playerId, json] of Object.entries(raw ?? {})) {
    out[playerId] = parseAnswer(json);
  }
  return out;
}

function parseScores(flat: string[]): ScoreEntry[] {
  const out: ScoreEntry[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    out.push({ playerId: flat[i], score: Number(flat[i + 1]) });
  }
  return out;
}

function parseRoster(raw: Record<string, string> | null): RosterEntry[] {
  return Object.values(raw ?? {}).map((v) => JSON.parse(v) as RosterEntry);
}

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

// Adds a roster entry unless the player is banned from the room, so a
// connection racing a ban can never end up registered.
// KEYS: [1]=players hash, [2]=banned set. ARGV: [1]=playerId, [2]=entry, [3]=TTL.
const REGISTER_PLAYER_SCRIPT = `
if redis.call('SISMEMBER', KEYS[2], ARGV[1]) == 1 then
  return 0
end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1
`;

// Claims the paused state, so two callers racing the same disconnect can't
// both pause (only the claimant tears timers down). EXISTS guards against
// re-creating the meta hash of a game that has already been deleted.
// KEYS: [1]=meta hash. ARGV: [1]=pausedAt, [2]=TTL.
const CLAIM_PAUSE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  return 0
end
local paused = redis.call('HGET', KEYS[1], 'pausedAt')
if paused ~= false and paused ~= '0' then
  return 0
end
redis.call('HSET', KEYS[1], 'pausedAt', ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
return 1
`;

// Clears the pause and applies the shifted timestamps in one step, but only
// while the game is still paused: two racing resumes (a reconnect and the
// sweeper, or two instances) must not shift the deadlines twice.
// KEYS: [1]=meta hash. ARGV: [1]=TTL, [2..]=flattened meta pairs.
const CLAIM_RESUME_SCRIPT = `
local paused = redis.call('HGET', KEYS[1], 'pausedAt')
if paused == false or paused == '0' then
  return 0
end
redis.call('HSET', KEYS[1], 'pausedAt', '0', unpack(ARGV, 2))
redis.call('EXPIRE', KEYS[1], ARGV[1])
return 1
`;

// Claims the ended-game transition so only one caller persists the result.
// First answer wins: the score is added only if the answer was stored, in the
// same atomic step. Returns who has answered so far (the early-close check
// needs it) or nil for a duplicate.
const RECORD_ANSWER_SCRIPT = `
if redis.call('HSETNX', KEYS[1], ARGV[1], ARGV[2]) == 0 then
  return false
end
redis.call('EXPIRE', KEYS[1], ARGV[4])
redis.call('ZINCRBY', KEYS[2], ARGV[3], ARGV[1])
redis.call('EXPIRE', KEYS[2], ARGV[4])
return redis.call('HKEYS', KEYS[1])
`;

// A further answer from a player who may send several: replaces the stored
// one only if it is still what the caller merged into (compare-and-set), so
// two answers racing from one player can't drop either. Scores are untouched
// — only unscored types take more than one answer.
const REPLACE_ANSWER_SCRIPT = `
if redis.call('HGET', KEYS[1], ARGV[1]) ~= ARGV[2] then
  return 0
end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return 1
`;

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
    return parseMeta(await this.redis.hgetall(keys.meta(code)));
  }

  /**
   * Everything the engine's phase machine reads. The meta says which
   * question's answers to read, so reading the current answers takes two
   * round trips (meta, then the parts pipelined); otherwise — no answers, or
   * `qIndex` given — the meta rides the same pipeline. Parts not requested
   * come back empty. Pass `qIndex` to read a specific question's answers
   * instead of the current one's.
   */
  async loadState(
    code: string,
    parts: readonly StatePart[],
    qIndex?: number,
  ): Promise<GameState | null> {
    const metaFirst = parts.includes("answers") && qIndex === undefined;
    const pipe = this.redis.pipeline();
    let meta: GameMeta | null = null;
    if (metaFirst) {
      meta = await this.getMeta(code);
      if (!meta) return null;
    } else {
      pipe.hgetall(keys.meta(code));
    }
    // Known whenever answers are requested: given, or read above.
    const answersOf = qIndex ?? meta?.qIndex ?? 0;
    for (const part of parts) {
      if (part === "questions") pipe.get(keys.questions(code));
      if (part === "roster") pipe.hgetall(keys.players(code));
      if (part === "answers") pipe.hgetall(keys.answers(code, answersOf));
      if (part === "scores") {
        pipe.zrevrange(keys.lb(code), 0, -1, "WITHSCORES");
      }
      if (part === "preloads") pipe.hgetall(keys.preloads(code, answersOf));
    }
    const results = (await pipe.exec()) ?? [];
    for (const [err] of results) if (err) throw err;
    if (!metaFirst) {
      meta = parseMeta(results.shift()?.[1] as Record<string, string>);
    }
    if (!meta) return null;
    const state: GameState = {
      meta,
      questions: [],
      roster: [],
      answers: {},
      scores: [],
      preloads: {},
    };
    parts.forEach((part, i) => {
      const value = results[i]?.[1] ?? null;
      if (part === "questions") {
        state.questions = parseQuestions(value as string | null) ?? [];
      } else if (part === "roster") {
        state.roster = parseRoster(value as Record<string, string>);
      } else if (part === "answers") {
        state.answers = parseAnswers(value as Record<string, string>);
      } else if (part === "preloads") {
        state.preloads = parsePreloads(value as Record<string, string>);
      } else {
        state.scores = parseScores(value as string[]);
      }
    });
    return state;
  }

  /** A device's download progress for question `qIndex`'s sound. */
  async setPreloadStatus(
    code: string,
    qIndex: number,
    deviceId: string,
    status: PreloadStatus,
  ): Promise<void> {
    await this.redis
      .multi()
      .hset(keys.preloads(code, qIndex), deviceId, JSON.stringify(status))
      .expire(keys.preloads(code, qIndex), TTL_SECONDS)
      .exec();
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
      // The ban list gets no writes of its own after the ban, so it rides the
      // meta's renewal — otherwise a room outliving the TTL would quietly
      // un-ban everyone. EXPIRE on a missing key is a no-op.
      .expire(keys.banned(code), TTL_SECONDS)
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

  /**
   * Claims the paused state for a duel. Returns false if the game is already
   * paused (or gone), so only one caller stops the timers — the check and the
   * write are one round trip, which is what makes it safe against a reconnect
   * racing the disconnect that triggered it.
   *
   * Pause/resume skip `patchMeta`, so they don't renew the ban set's TTL —
   * deliberate: they are duel-only paths and duels have no ban list.
   */
  async claimPause(code: string, atMs: number): Promise<boolean> {
    const claimed = await this.redis.eval(
      CLAIM_PAUSE_SCRIPT,
      1,
      keys.meta(code),
      String(atMs),
      TTL_SECONDS,
    );
    return claimed === 1;
  }

  /**
   * Clears `pausedAt` and applies `patch` (the shifted timestamps) in the same
   * round trip, only while the game is still paused. Returns false when
   * another caller already resumed it, so the deadlines can never be shifted
   * twice by a reconnect racing the sweeper.
   */
  async claimResume(code: string, patch: Partial<GameMeta>): Promise<boolean> {
    const flat = this.flattenMeta({ ...patch, pausedAt: undefined });
    const claimed = await this.redis.eval(
      CLAIM_RESUME_SCRIPT,
      1,
      keys.meta(code),
      TTL_SECONDS,
      ...flat,
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

  // -- answers -------------------------------------------------------------

  /**
   * Stores a player's answer and adds its score — one command on the hot
   * path. First answer wins: returns null if the player already answered,
   * otherwise the ids of everyone who has answered `qIndex` so far.
   */
  async recordAnswer(
    code: string,
    qIndex: number,
    playerId: string,
    answer: StoredAnswer,
  ): Promise<string[] | null> {
    const answered = await this.redis.eval(
      RECORD_ANSWER_SCRIPT,
      2,
      keys.answers(code, qIndex),
      keys.lb(code),
      playerId,
      JSON.stringify(answer),
      answer.score,
      TTL_SECONDS,
    );
    return (answered as string[] | null) ?? null;
  }

  /** One player's stored answer, raw (for `replaceAnswer`), or null. */
  async getAnswerRaw(
    code: string,
    qIndex: number,
    playerId: string,
  ): Promise<string | null> {
    return this.redis.hget(keys.answers(code, qIndex), playerId);
  }

  /**
   * Swaps a player's stored answer for `next` if it is still `previousRaw`.
   * False when another write got there first — re-read and merge again.
   */
  async replaceAnswer(
    code: string,
    qIndex: number,
    playerId: string,
    previousRaw: string,
    next: StoredAnswer,
  ): Promise<boolean> {
    const replaced = await this.redis.eval(
      REPLACE_ANSWER_SCRIPT,
      1,
      keys.answers(code, qIndex),
      playerId,
      previousRaw,
      JSON.stringify(next),
      TTL_SECONDS,
    );
    return replaced === 1;
  }

  async getAnswers(
    code: string,
    qIndex: number,
  ): Promise<Record<string, StoredAnswer>> {
    return parseAnswers(await this.redis.hgetall(keys.answers(code, qIndex)));
  }

  async answerCount(code: string, qIndex: number): Promise<number> {
    return this.redis.hlen(keys.answers(code, qIndex));
  }

  // -- leaderboard ---------------------------------------------------------

  /** playerId → score, descending. */
  async leaderboard(code: string): Promise<ScoreEntry[]> {
    return parseScores(
      await this.redis.zrevrange(keys.lb(code), 0, -1, "WITHSCORES"),
    );
  }

  // -- roster ----------------------------------------------------------------

  async upsertPlayer(code: string, entry: RosterEntry): Promise<void> {
    await this.redis
      .multi()
      .hset(keys.players(code), entry.id, JSON.stringify(entry))
      .expire(keys.players(code), TTL_SECONDS)
      .exec();
  }

  /**
   * Roster write that loses to a ban: returns false (and writes nothing) when
   * the player is banned. Checking and writing in one round trip is what makes
   * a connection that raced the ban impossible to admit.
   */
  async upsertPlayerUnlessBanned(
    code: string,
    entry: RosterEntry,
  ): Promise<boolean> {
    const registered = await this.redis.eval(
      REGISTER_PLAYER_SCRIPT,
      2,
      keys.players(code),
      keys.banned(code),
      entry.id,
      JSON.stringify(entry),
      TTL_SECONDS,
    );
    return registered === 1;
  }

  async getPlayer(code: string, playerId: string): Promise<RosterEntry | null> {
    const raw = await this.redis.hget(keys.players(code), playerId);
    return raw ? (JSON.parse(raw) as RosterEntry) : null;
  }

  /**
   * Drops the roster entry *and* the score: a removed player must not linger
   * on the leaderboard as a nameless row (buildLeaderboard resolves names from
   * the roster). Someone who rejoins later starts from zero.
   */
  async removePlayer(code: string, playerId: string): Promise<void> {
    await this.redis
      .multi()
      .hdel(keys.players(code), playerId)
      .zrem(keys.lb(code), playerId)
      .exec();
  }

  async roster(code: string): Promise<RosterEntry[]> {
    return parseRoster(await this.redis.hgetall(keys.players(code)));
  }

  // -- bans ------------------------------------------------------------------

  /**
   * Room-scoped ban list. Lives and dies with the game (deleteGame clears it),
   * so a ban blocks rejoining *this* room — a later room for the same quiz
   * starts with a clean slate.
   */
  async banPlayer(code: string, playerId: string): Promise<void> {
    await this.redis
      .multi()
      .sadd(keys.banned(code), playerId)
      .expire(keys.banned(code), TTL_SECONDS)
      .exec();
  }

  async isBanned(code: string, playerId: string): Promise<boolean> {
    const member = await this.redis.sismember(keys.banned(code), playerId);
    return member === 1;
  }

  async bannedPlayers(code: string): Promise<string[]> {
    return this.redis.smembers(keys.banned(code));
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
      keys.banned(code),
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
