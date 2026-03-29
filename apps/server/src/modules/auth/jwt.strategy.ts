import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { AuthUser } from "../../common/decorators/current-user.decorator";

export type ApiJwtPayload = { sub: string; email?: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("NEXTAUTH_SECRET"),
    });
  }

  validate(payload: ApiJwtPayload): AuthUser {
    return { userId: payload.sub, email: payload.email };
  }
}
