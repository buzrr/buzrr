import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { PrismaService } from "../../prisma/prisma.service";
import { REDIS } from "../../redis/redis.constants";

export const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** Gives the boot path (migrations, Redis) time to settle. */
const FIRST_RUN_DELAY_MS = 5 * 60_000;
/** One pass per day across all instances (shorter than the interval). */
const LOCK_KEY = "players:cleanup:lock";
const LOCK_TTL_MS = 23 * 60 * 60 * 1000;
const BATCH_SIZE = 1000;
/** Upper bound per pass; a bigger backlog continues the next day. */
const MAX_BATCHES = 200;

/**
 * Guest players are throwaway identities (ADR-005) and finished games
 * snapshot their names, so old rows are only clutter. Their token lives 7
 * days, so a row is kept longer than that: a guest who can still use their
 * token always still has their row.
 */
export const MIN_RETENTION_DAYS = 8;
export const DEFAULT_RETENTION_DAYS = 8;

/** `PLAYER_RETENTION_DAYS`, never below the token's lifetime. */
export function retentionDays(raw: string | undefined): number {
  const n = Number(raw);
  if (!raw || !Number.isFinite(n)) return DEFAULT_RETENTION_DAYS;
  return Math.max(MIN_RETENTION_DAYS, Math.floor(n));
}

/**
 * Deletes guest `Player` rows not in a room (`gameId` null — a room's
 * players point at its live `GameSession`) and older than the retention, in
 * batches, once a day. Lazy on Redis: one `SET NX` per instance per day.
 */
@Injectable()
export class PlayerCleanupService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(PlayerCleanupService.name);
  private firstRun: NodeJS.Timeout | null = null;
  private worker: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  onApplicationBootstrap(): void {
    this.firstRun = setTimeout(() => this.runSafely(), FIRST_RUN_DELAY_MS);
    this.firstRun.unref();
    this.worker = setInterval(() => this.runSafely(), CLEANUP_INTERVAL_MS);
    this.worker.unref();
  }

  onModuleDestroy(): void {
    if (this.firstRun) clearTimeout(this.firstRun);
    if (this.worker) clearInterval(this.worker);
    this.firstRun = null;
    this.worker = null;
  }

  private runSafely(): void {
    void this.cleanup().catch((err) =>
      this.logger.error(
        "Player cleanup failed",
        err instanceof Error ? err.stack : String(err),
      ),
    );
  }

  async cleanup(
    now: Date = new Date(),
  ): Promise<{ skipped: true } | { skipped: false; deleted: number }> {
    const claim = await this.redis.set(LOCK_KEY, "1", "PX", LOCK_TTL_MS, "NX");
    if (claim !== "OK") return { skipped: true };

    const days = retentionDays(
      this.config.get<string>("PLAYER_RETENTION_DAYS"),
    );
    const before = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    let deleted = 0;
    for (let i = 0; i < MAX_BATCHES; i++) {
      const batch = await this.prisma.db.player.findMany({
        where: { gameId: null, createdAt: { lt: before } },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;
      // `gameId: null` again: a player who joined a room meanwhile stays.
      const { count } = await this.prisma.db.player.deleteMany({
        where: { id: { in: batch.map((p) => p.id) }, gameId: null },
      });
      deleted += count;
      if (batch.length < BATCH_SIZE) break;
    }
    this.logger.log(
      `Player cleanup: deleted ${deleted} guest player(s) older than ${days} days`,
    );
    return { skipped: false, deleted };
  }
}
