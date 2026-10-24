import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Request, Response } from "express";
import Redis from "ioredis";
import { Public } from "../../common/decorators/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { REDIS } from "../../redis/redis.constants";
import { GameEngineService } from "../game-engine/game-engine.service";

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

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

@Controller("health")
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private draining = false;
  private lastRunning = -1;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly engine: GameEngineService,
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

  /**
   * Readiness: like the health check, but 503 once draining, so the load
   * balancer sends new connections to other instances. Liveness and the
   * Docker HEALTHCHECK keep using the plain check.
   */
  @Public()
  @Get("ready")
  async ready(@Res({ passthrough: true }) res: Response) {
    const health = await this.check(res);
    if (!this.draining) return health;
    res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { ...health, status: "draining" };
  }

  /**
   * Starts draining (rolling deploy: called by the pod's preStop hook, see
   * apps/server/scripts/drain.mjs) and lists the games still running here.
   * The caller polls until the list is empty, then lets the process stop.
   * Loopback only — the instance's own container, never through a proxy.
   */
  @Public()
  @Post("drain")
  @HttpCode(HttpStatus.OK)
  async drain(@Req() req: Request) {
    if (!LOOPBACK.has(req.socket.remoteAddress ?? "")) {
      throw new ForbiddenException();
    }
    if (!this.draining) {
      this.draining = true;
      this.logger.log(
        "Draining: no new connections, waiting for running games",
      );
    }
    const games = await this.engine.runningHere();
    if (games.length !== this.lastRunning) {
      this.lastRunning = games.length;
      this.logger.log(
        games.length > 0
          ? `Draining: ${games.length} game(s) still running here (${games.join(", ")})`
          : "Drained: no games running here",
      );
    }
    return { draining: true, games };
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
