import { Injectable, ServiceUnavailableException, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { RateLimitProfile } from "../decorators/rate-limit-profile.decorator";

@Injectable()
export class RateLimitService {
  private readonly defaultLimit: Ratelimit | null;
  private readonly aiLimit: Ratelimit | null;

  constructor(private readonly config: ConfigService) {
    const url = config.get<string>("UPSTASH_REDIS_URL");
    const token = config.get<string>("UPSTASH_REDIS_TOKEN");
    if (!url || !token) {
      this.defaultLimit = null;
      this.aiLimit = null;
      return;
    }
    const redis = new Redis({ url, token });
    this.defaultLimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, "120s"),
    });
    this.aiLimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "300s"),
    });
  }

  isEnabled(): boolean {
    return this.config.get<string>("RATELIMIT") === "ON";
  }

  async limitOrThrow(
    identifier: string,
    profile: RateLimitProfile = "default",
  ): Promise<void> {
    if (!this.isEnabled()) return;
    const limiter =
      profile === "ai" ? this.aiLimit : this.defaultLimit;
    if (!limiter) {
      throw new ServiceUnavailableException(
        "Rate limiting is ON but Upstash is not configured",
      );
    }
    const { success } = await limiter.limit(identifier);
    if (!success) {
      throw new BadRequestException(
        "Rate limit reached wait for some time and try again.",
      );
    }
  }
}
