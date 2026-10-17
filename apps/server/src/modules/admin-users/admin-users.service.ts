import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@buzrr/prisma";
import { PrismaService } from "../../prisma/prisma.service";

const DEFAULT_LIMIT = 20;

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * All users (the superadmin's user management list), optionally filtered by
   * `search` on name or email. The internal system user is left out.
   */
  async list(params: { search?: string; cursor?: string; limit?: number }) {
    const limit = params.limit ?? DEFAULT_LIMIT;
    const where: Prisma.UserWhereInput = params.search
      ? {
          OR: [
            { name: { contains: params.search, mode: "insensitive" } },
            { email: { contains: params.search, mode: "insensitive" } },
          ],
        }
      : {};

    const rows = await this.prisma.db.user.findMany({
      where: { AND: [where, { email: { not: "system@buzrr.local" } }] },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      select: { id: true, name: true, email: true, image: true, role: true },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1]!.id : null,
    };
  }

  async setRole(
    actingUserId: string,
    targetUserId: string,
    role: "admin" | "user",
  ): Promise<void> {
    if (actingUserId === targetUserId) {
      throw new BadRequestException("You cannot change your own role");
    }
    const target = await this.prisma.db.user.findUnique({
      where: { id: targetUserId },
      select: { role: true },
    });
    if (!target) {
      throw new NotFoundException("User not found");
    }
    if (target.role === "superadmin") {
      throw new ForbiddenException("Superadmins cannot be changed here");
    }
    if (role === "admin" && target.role !== "user") {
      throw new BadRequestException("Only a user can be promoted to admin");
    }
    if (role === "user" && target.role !== "admin") {
      throw new BadRequestException("Only an admin can be demoted to user");
    }

    await this.prisma.db.user.update({
      where: { id: targetUserId },
      data: { role },
    });
  }
}
