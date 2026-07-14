import "server-only";
import { prisma } from "@buzrr/prisma";
import type { Role } from "@/types/db";

export async function getUserRole(userId: string): Promise<Role> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role ?? "user";
}
