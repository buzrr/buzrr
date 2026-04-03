import { SetMetadata } from "@nestjs/common";

export const RATE_LIMIT_PROFILE_KEY = "rateLimitProfile";

export type RateLimitProfile = "default" | "ai";

export const RateLimitProfile = (profile: RateLimitProfile) =>
  SetMetadata(RATE_LIMIT_PROFILE_KEY, profile);
