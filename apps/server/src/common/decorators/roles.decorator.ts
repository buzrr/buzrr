import { SetMetadata } from "@nestjs/common";
import type { Role } from "@buzrr/prisma";

export const ROLES_KEY = "roles";

/** Route/controller is only reachable by accounts whose current DB role is one of these. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
