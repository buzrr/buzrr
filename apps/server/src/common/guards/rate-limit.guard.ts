import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import {
  RATE_LIMIT_PROFILE_KEY,
  RateLimitProfile,
} from "../decorators/rate-limit-profile.decorator";
import { RateLimitService } from "../services/rate-limit.service";

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly rateLimit: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.rateLimit.isEnabled()) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const forwarded = request.headers["x-forwarded-for"];
    const ip =
      typeof forwarded === "string"
        ? forwarded.split(",")[0]?.trim()
        : request.ip;
    if (!ip) {
      throw new BadRequestException("IP not found");
    }
    const profile =
      this.reflector.getAllAndOverride<RateLimitProfile>(
        RATE_LIMIT_PROFILE_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? "default";
    await this.rateLimit.limitOrThrow(ip, profile);
    return true;
  }
}
