import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";

export type AuthUser = { userId: string; email?: string };

/** Set by JWT strategy when `typ === "player"` in the access token payload. */
export type PlayerAuthUser = { playerId: string };

export type JwtRequestUser = AuthUser | PlayerAuthUser;

export function isPlayerAuthUser(u: JwtRequestUser): u is PlayerAuthUser {
  return "playerId" in u;
}

export function isAuthUser(u: JwtRequestUser): u is AuthUser {
  return "userId" in u;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtRequestUser => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtRequestUser }>();
    return request.user;
  },
);

/** Quiz-owner / admin JWT only (rejects player tokens). */
export const CurrentAccountUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtRequestUser }>();
    const u = request.user;
    if (!isAuthUser(u)) {
      throw new UnauthorizedException();
    }
    return u;
  },
);

/** Player session JWT only (rejects account tokens). */
export const CurrentPlayerUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlayerAuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtRequestUser }>();
    const u = request.user;
    if (!isPlayerAuthUser(u)) {
      throw new UnauthorizedException();
    }
    return u;
  },
);
