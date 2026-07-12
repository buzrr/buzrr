import { Global, Logger, Module, OnApplicationShutdown } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import Redis from "ioredis";
import { REDIS, REDIS_PUB, REDIS_SUB } from "./redis.constants";

const logger = new Logger("RedisModule");

function createClient(name: string): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "REDIS_URL is not set. The realtime game engine requires a Redis-protocol " +
        "endpoint (e.g. Upstash: rediss://default:<token>@<host>:6379).",
    );
  }
  const client = new Redis(url, {
    maxRetriesPerRequest: 3,
    // Upstash closes idle connections; keep the socket alive.
    keepAlive: 10_000,
  });
  client.on("error", (err) => logger.error(`[${name}] ${err.message}`));
  client.on("connect", () => logger.log(`[${name}] connected`));
  return client;
}

@Global()
@Module({
  providers: [
    { provide: REDIS, useFactory: () => createClient("commands") },
    { provide: REDIS_PUB, useFactory: () => createClient("pub") },
    { provide: REDIS_SUB, useFactory: () => createClient("sub") },
  ],
  exports: [REDIS, REDIS_PUB, REDIS_SUB],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown(): Promise<void> {
    for (const token of [REDIS, REDIS_PUB, REDIS_SUB]) {
      const client = this.moduleRef.get<Redis>(token, { strict: false });
      await client.quit().catch(() => client.disconnect());
    }
  }
}
