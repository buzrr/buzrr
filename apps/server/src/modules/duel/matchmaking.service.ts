import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { createBotOpponent } from "../../common/utils/duel-bot";
import { REDIS } from "../../redis/redis.constants";
import { GameEngineService } from "../game-engine/game-engine.service";
import type { LiveQuestion } from "../game-engine/game-engine.types";
import type { TypedServer } from "../realtime/realtime.types";
import { generateDuelCode } from "./duel-code";
import { DuelQuestionsService } from "./duel-questions.service";

const QUEUE_KEY = "mm:duel:queue"; // zset userId -> elo
const META_KEY = "mm:duel:meta"; // hash userId -> JSON {name, image, joinedAt}
const LOCK_KEY = "mm:duel:lock";

const QUEUE_TIMEOUT_MS = 60_000;
const TICK_MS = 2_000;
/** Wait this long with nobody else in the queue and you get a bot. */
const BOT_MATCH_MS = 12_000;

interface QueueEntry {
  userId: string;
  elo: number;
  name: string;
  image: string | null;
  joinedAt: number;
}

/** Rating gap a player will accept, widening the longer they have waited. */
function eloBand(waitMs: number): number {
  return Math.min(100 + 50 * Math.floor(waitMs / 5_000), 500);
}

/**
 * Either side's band is enough: tick() gives every entry a turn as seeker, so
 * a long waiter's widened band can reach a rating its own is too narrow for.
 */
function eloEligible(a: QueueEntry, b: QueueEntry, now: number): boolean {
  const gap = Math.abs(a.elo - b.elo);
  return gap <= Math.max(eloBand(now - a.joinedAt), eloBand(now - b.joinedAt));
}

/**
 * Redis-backed 1v1 matchmaking. Players are held in a sorted set keyed by
 * ELO; a 2s worker (running only while the queue is non-empty, to spare the
 * Upstash command budget) pairs the longest-waiting player with anyone whose
 * rating falls inside a band that widens the longer they wait.
 *
 * A player left alone in the queue for BOT_MATCH_MS is matched with a bot
 * instead of waiting out the full timeout. Set DUEL_BOTS=OFF to disable.
 */
@Injectable()
export class MatchmakingService implements OnApplicationShutdown {
  private readonly logger = new Logger(MatchmakingService.name);
  private io: TypedServer | null = null;
  private worker: NodeJS.Timeout | null = null;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly questions: DuelQuestionsService,
    private readonly engine: GameEngineService,
    private readonly config: ConfigService,
  ) {}

  setServer(io: TypedServer): void {
    this.io = io;
  }

  onApplicationShutdown(): void {
    if (this.worker) clearInterval(this.worker);
  }

  async enqueue(user: {
    id: string;
    name: string;
    image: string | null;
    elo: number;
  }): Promise<void> {
    await this.redis
      .multi()
      .zadd(QUEUE_KEY, user.elo, user.id)
      .hset(
        META_KEY,
        user.id,
        JSON.stringify({
          name: user.name,
          image: user.image,
          joinedAt: Date.now(),
        }),
      )
      .exec();
    this.io?.to(`player:${user.id}`).emit("duel:queued", { elo: user.elo });
    this.ensureWorker();
    await this.tick();
  }

  async dequeue(userId: string): Promise<void> {
    await this.redis
      .multi()
      .zrem(QUEUE_KEY, userId)
      .hdel(META_KEY, userId)
      .exec();
  }

  private ensureWorker(): void {
    if (this.worker) return;
    this.worker = setInterval(() => {
      void this.tick().catch((err) =>
        this.logger.error("Matchmaking tick failed", err),
      );
    }, TICK_MS);
    this.worker.unref();
  }

  private stopWorkerIfIdle(queueSize: number): void {
    if (queueSize === 0 && this.worker) {
      clearInterval(this.worker);
      this.worker = null;
    }
  }

  private async tick(): Promise<void> {
    const entries = await this.loadQueue();
    this.stopWorkerIfIdle(entries.length);
    if (entries.length === 0) return;

    const now = Date.now();

    // Expire players who waited too long.
    for (const entry of entries) {
      if (now - entry.joinedAt > QUEUE_TIMEOUT_MS) {
        await this.dequeue(entry.userId);
        this.io?.to(`player:${entry.userId}`).emit("duel:queue-timeout");
      }
    }
    const waiting = entries.filter((e) => now - e.joinedAt <= QUEUE_TIMEOUT_MS);
    if (waiting.length === 0) return;

    // Longest-waiting player searches first, with a widening band.
    waiting.sort((a, b) => a.joinedAt - b.joinedAt);
    for (const seeker of waiting) {
      const band = eloBand(now - seeker.joinedAt);
      const candidate = waiting.find(
        (c) =>
          c.userId !== seeker.userId && Math.abs(c.elo - seeker.elo) <= band,
      );
      if (!candidate) continue;
      const paired = await this.pair(seeker, candidate);
      if (paired) return; // one match per tick keeps things simple
    }

    // Nobody could be paired with a human — fall back to a bot.
    if (this.config.get<string>("DUEL_BOTS") === "OFF") return;
    for (const seeker of waiting) {
      if (now - seeker.joinedAt < BOT_MATCH_MS) continue;
      if (await this.tryBotMatch(seeker)) return;
    }
  }

  /**
   * Re-reads the queue before committing: a human may have joined since this
   * tick's snapshot, and pairing two players always beats botting one. Only a
   * human this seeker could actually be paired with blocks the fallback —
   * someone stuck outside the band would otherwise keep both of them waiting
   * out the full timeout for a match that can never happen.
   */
  private async tryBotMatch(seeker: QueueEntry): Promise<boolean> {
    const now = Date.now();
    const fresh = await this.loadQueue();
    const reachable = fresh.filter(
      (e) =>
        e.userId !== seeker.userId &&
        now - e.joinedAt <= QUEUE_TIMEOUT_MS &&
        eloEligible(seeker, e, now),
    );
    if (reachable.length > 0) return false;

    const lock = await this.redis.set(LOCK_KEY, "1", "PX", 5_000, "NX");
    if (lock !== "OK") return false;
    try {
      const removed = await this.redis.zrem(QUEUE_KEY, seeker.userId);
      if (removed !== 1) return false; // another instance already took them
      await this.redis.hdel(META_KEY, seeker.userId);
      await this.createBotDuel(seeker);
      return true;
    } finally {
      await this.redis.del(LOCK_KEY);
    }
  }

  /** Atomically claim both players; abort if another instance beat us. */
  private async pair(a: QueueEntry, b: QueueEntry): Promise<boolean> {
    const lock = await this.redis.set(LOCK_KEY, "1", "PX", 5_000, "NX");
    if (lock !== "OK") return false;
    try {
      const removed = await this.redis.zrem(QUEUE_KEY, a.userId, b.userId);
      if (removed !== 2) {
        // Someone else took one of them; put back whoever we removed.
        if (removed === 1) {
          const stillA = await this.redis.zscore(QUEUE_KEY, a.userId);
          const gone = stillA === null ? a : b;
          await this.redis.zadd(QUEUE_KEY, gone.elo, gone.userId);
        }
        return false;
      }
      await this.redis.hdel(META_KEY, a.userId, b.userId);
      await this.createDuel(a, b);
      return true;
    } finally {
      await this.redis.del(LOCK_KEY);
    }
  }

  private async createDuel(a: QueueEntry, b: QueueEntry): Promise<void> {
    let questions: LiveQuestion[];
    try {
      questions = await this.questions.build();
    } catch (err) {
      this.logger.error("Failed to build duel question set", err);
      for (const p of [a, b]) {
        this.io?.to(`player:${p.userId}`).emit("duel:error", {
          message: "No duel questions are available right now.",
        });
      }
      return;
    }

    const gameCode = generateDuelCode();
    await this.engine.startDuel(
      gameCode,
      [a, b].map((p) => ({
        id: p.userId,
        name: p.name,
        profilePic: p.image,
        userId: p.userId,
      })),
      questions,
    );

    this.io?.to(`player:${a.userId}`).emit("duel:matched", {
      gameCode,
      opponent: { id: b.userId, name: b.name, profilePic: b.image, elo: b.elo },
    });
    this.io?.to(`player:${b.userId}`).emit("duel:matched", {
      gameCode,
      opponent: { id: a.userId, name: a.name, profilePic: a.image, elo: a.elo },
    });
    this.logger.log(
      `Matched duel ${gameCode}: ${a.userId} (${a.elo}) vs ${b.userId} (${b.elo})`,
    );
  }

  /**
   * Same rated duel as a human match — the bot is just a roster entry the
   * engine answers for. The `duel:matched` payload is deliberately identical
   * in shape to a human one, so the client can't tell them apart.
   */
  private async createBotDuel(human: QueueEntry): Promise<void> {
    let questions: LiveQuestion[];
    try {
      questions = await this.questions.build();
    } catch (err) {
      this.logger.error("Failed to build duel question set", err);
      this.io?.to(`player:${human.userId}`).emit("duel:error", {
        message: "No duel questions are available right now.",
      });
      return;
    }

    const bot = createBotOpponent(human.elo);
    const gameCode = generateDuelCode();
    await this.engine.startDuel(
      gameCode,
      [
        {
          id: human.userId,
          name: human.name,
          profilePic: human.image,
          userId: human.userId,
        },
        {
          id: bot.id,
          name: bot.name,
          profilePic: bot.profilePic,
          connected: true,
        },
      ],
      questions,
      { bot: { id: bot.id, tier: bot.tier, elo: bot.elo } },
    );

    this.io?.to(`player:${human.userId}`).emit("duel:matched", {
      gameCode,
      opponent: {
        id: bot.id,
        name: bot.name,
        profilePic: bot.profilePic,
        elo: bot.elo,
      },
    });
    this.logger.log(
      `Matched duel ${gameCode}: ${human.userId} (${human.elo}) vs ${bot.tier} bot (${bot.elo})`,
    );
  }

  private async loadQueue(): Promise<QueueEntry[]> {
    const flat = await this.redis.zrange(QUEUE_KEY, 0, -1, "WITHSCORES");
    if (flat.length === 0) return [];
    const meta = await this.redis.hgetall(META_KEY);
    const entries: QueueEntry[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      const userId = flat[i];
      const elo = Number(flat[i + 1]);
      const m = meta[userId]
        ? (JSON.parse(meta[userId]) as {
            name: string;
            image: string | null;
            joinedAt: number;
          })
        : { name: "Player", image: null, joinedAt: Date.now() };
      entries.push({ userId, elo, ...m });
    }
    return entries;
  }
}
