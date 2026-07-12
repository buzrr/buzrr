import { Inject, Injectable, Logger, OnApplicationShutdown } from "@nestjs/common";
import Redis from "ioredis";
import { customAlphabet } from "nanoid";
import { REDIS } from "../../redis/redis.constants";
import { PrismaService } from "../../prisma/prisma.service";
import { GameEngineService } from "../game-engine/game-engine.service";
import type { LiveQuestion } from "../game-engine/game-engine.types";
import type { TypedServer } from "../realtime/realtime.types";

const QUEUE_KEY = "mm:duel:queue"; // zset userId -> elo
const META_KEY = "mm:duel:meta"; // hash userId -> JSON {name, image, joinedAt}
const LOCK_KEY = "mm:duel:lock";

const QUEUE_TIMEOUT_MS = 60_000;
const TICK_MS = 2_000;
const DUEL_QUESTION_COUNT = 7;
const MIN_QUESTIONS = 3;

const generateDuelCode = customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 5);

interface QueueEntry {
  userId: string;
  elo: number;
  name: string;
  image: string | null;
  joinedAt: number;
}

/**
 * Redis-backed 1v1 matchmaking. Players are held in a sorted set keyed by
 * ELO; a 2s worker (running only while the queue is non-empty, to spare the
 * Upstash command budget) pairs the longest-waiting player with anyone whose
 * rating falls inside a band that widens the longer they wait.
 */
@Injectable()
export class MatchmakingService implements OnApplicationShutdown {
  private readonly logger = new Logger(MatchmakingService.name);
  private io: TypedServer | null = null;
  private worker: NodeJS.Timeout | null = null;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly engine: GameEngineService,
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
    const waiting = entries.filter(
      (e) => now - e.joinedAt <= QUEUE_TIMEOUT_MS,
    );
    if (waiting.length < 2) return;

    // Longest-waiting player searches first, with a widening band.
    waiting.sort((a, b) => a.joinedAt - b.joinedAt);
    for (const seeker of waiting) {
      const waitSec = (now - seeker.joinedAt) / 1000;
      const band = Math.min(100 + 50 * Math.floor(waitSec / 5), 500);
      const candidate = waiting.find(
        (c) =>
          c.userId !== seeker.userId &&
          Math.abs(c.elo - seeker.elo) <= band,
      );
      if (!candidate) continue;
      const paired = await this.pair(seeker, candidate);
      if (paired) return; // one match per tick keeps things simple
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
      questions = await this.buildQuestionSet();
    } catch (err) {
      this.logger.error("Failed to build duel question set", err);
      for (const p of [a, b]) {
        this.io
          ?.to(`player:${p.userId}`)
          .emit("duel:error", {
            message: "No duel questions are available right now.",
          });
      }
      return;
    }

    const gameCode = `D${generateDuelCode()}`;
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

  /** Random questions drawn from public quizzes, snapshotted into Redis. */
  private async buildQuestionSet(): Promise<LiveQuestion[]> {
    const ids = await this.prisma.db.$queryRaw<{ id: string }[]>`
      SELECT q."id" FROM "Question" q
      JOIN "Quiz" z ON z."id" = q."quizId"
      WHERE z."isPublic" = true
      ORDER BY random()
      LIMIT ${DUEL_QUESTION_COUNT}
    `;
    const rows = await this.prisma.db.question.findMany({
      where: { id: { in: ids.map((r) => r.id) } },
      include: { options: { orderBy: { createdAt: "asc" } } },
    });
    const questions: LiveQuestion[] = rows
      .filter((q) => q.options.length >= 2 && q.options.some((o) => o.isCorrect))
      .map((q) => ({
        id: q.id,
        title: q.title,
        media: q.media,
        mediaType: q.mediaType,
        timeOut: q.timeOut,
        options: q.options.map((o) => ({
          id: o.id,
          title: o.title,
          isCorrect: o.isCorrect,
        })),
      }));
    if (questions.length < MIN_QUESTIONS) {
      throw new Error(
        `Only ${questions.length} usable public questions (need ${MIN_QUESTIONS})`,
      );
    }
    return questions;
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
