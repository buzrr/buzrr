import { Controller, Get, HttpStatus, Inject, Res } from "@nestjs/common";
import type { Response } from "express";
import Redis from "ioredis";
import { Public } from "../../common/decorators/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { REDIS } from "../../redis/redis.constants";

type DependencyStatus = "up" | "down";

const PING_TIMEOUT_MS = 2_000;

// A hung dependency must not hang the probe itself.
function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("timed out")), PING_TIMEOUT_MS),
    ),
  ]);
}

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Public()
  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const [database, redis] = await Promise.all([
      this.pingDatabase(),
      this.pingRedis(),
    ]);
    const healthy = database === "up" && redis === "up";
    res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: healthy ? "ok" : "error",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      services: { database, redis },
    };
  }

  private async pingDatabase(): Promise<DependencyStatus> {
    try {
      await withTimeout(this.prisma.db.$queryRaw`SELECT 1`);
      return "up";
    } catch {
      return "down";
    }
  }

  private async pingRedis(): Promise<DependencyStatus> {
    try {
      await withTimeout(this.redis.ping());
      return "up";
    } catch {
      return "down";
    }
  }
}
