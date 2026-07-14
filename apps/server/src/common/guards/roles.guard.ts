import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@buzrr/prisma";
import { PrismaService } from "../../prisma/prisma.service";
import {
  isAuthUser,
  JwtRequestUser,
} from "../decorators/current-user.decorator";
import { ROLES_KEY } from "../decorators/roles.decorator";

/**
 * Role is never trusted from the JWT (access tokens are cached client-side
 * for 7 days, so a demotion must take effect immediately) -- this always
 * does a fresh DB lookup of the caller's current role.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles || roles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user: JwtRequestUser }>();
    const user = request.user;
    if (!isAuthUser(user)) {
      throw new UnauthorizedException();
    }

    const record = await this.prisma.db.user.findUnique({
      where: { id: user.userId },
      select: { role: true },
    });
    if (!record || !roles.includes(record.role)) {
      throw new ForbiddenException("Insufficient role");
    }
    return true;
  }
}
