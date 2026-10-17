"use server";

import { headers } from "next/headers";
import { hashPassword } from "better-auth/crypto";
import { prisma } from "@buzrr/prisma";
import { auth } from "@/lib/auth";
import { getUserRole } from "@/lib/get-current-role";

/**
 * Superadmin user management that needs Better Auth's password hashing, so it
 * lives here in the web app (which owns auth) instead of the Nest API. Works
 * with self sign-up closed (AUTH_EMAIL_SIGNUP=OFF).
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

const MIN_PASSWORD_LENGTH = 8; // matches emailAndPassword.minPasswordLength
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireSuperadmin(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const role = await getUserRole(session.user.id);
  return role === "superadmin" ? session.user.id : null;
}

export async function createUserAction(input: {
  name: string;
  email: string;
  password: string;
  role: "user" | "admin";
}): Promise<ActionResult> {
  if (!(await requireSuperadmin())) return { ok: false, error: "Forbidden" };

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "Name is required" };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Invalid email address" };
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }
  if (input.role !== "user" && input.role !== "admin") {
    return { ok: false, error: "Invalid role" };
  }
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, error: "A user with this email already exists" };
  }

  const password = await hashPassword(input.password);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, emailVerified: true, role: input.role },
    });
    // Same shape Better Auth writes for an email + password sign-up.
    await tx.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password,
      },
    });
  });
  return { ok: true };
}

export async function resetPasswordAction(input: {
  userId: string;
  password: string;
}): Promise<ActionResult> {
  if (!(await requireSuperadmin())) return { ok: false, error: "Forbidden" };
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true },
  });
  if (!user) return { ok: false, error: "User not found" };

  const password = await hashPassword(input.password);
  await prisma.$transaction(async (tx) => {
    const credential = await tx.account.findFirst({
      where: { userId: user.id, providerId: "credential" },
      select: { id: true },
    });
    if (credential) {
      await tx.account.update({
        where: { id: credential.id },
        data: { password },
      });
    } else {
      // e.g. a Google-only account: give it a local password as well.
      await tx.account.create({
        data: {
          userId: user.id,
          providerId: "credential",
          accountId: user.id,
          password,
        },
      });
    }
    // Sign the user out everywhere so the old password's sessions end.
    await tx.session.deleteMany({ where: { userId: user.id } });
  });
  return { ok: true };
}
