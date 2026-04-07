import "server-only";
import { authConfig } from "@/auth/config";
import type { Session } from "next-auth";

type AuthInstance = {
  auth: (...args: unknown[]) => Promise<unknown>;
  signIn: (...args: unknown[]) => Promise<unknown>;
  signOut: (...args: unknown[]) => Promise<unknown>;
  handlers: {
    GET: (...args: unknown[]) => Promise<Response>;
    POST: (...args: unknown[]) => Promise<Response>;
  };
};

let authInstancePromise: Promise<AuthInstance> | null = null;

async function getAuthInstance(): Promise<AuthInstance> {
  if (!authInstancePromise) {
    authInstancePromise = (async () => {
      const [{ default: NextAuth }, { PrismaAdapter }, { prisma }] =
        await Promise.all([
          import("next-auth"),
          import("@auth/prisma-adapter"),
          import("@buzrr/prisma"),
        ]);

      return NextAuth({
        ...authConfig,
        adapter: PrismaAdapter(prisma),
      }) as AuthInstance;
    })();
  }
  return authInstancePromise;
}

export const handlers = {
  GET: async (...args: unknown[]) =>
    (await getAuthInstance()).handlers.GET(...args),
  POST: async (...args: unknown[]) =>
    (await getAuthInstance()).handlers.POST(...args),
};

export async function auth(): Promise<Session | null> {
  return (await getAuthInstance()).auth() as Promise<Session | null>;
}

export async function signIn(...args: unknown[]) {
  return (await getAuthInstance()).signIn(...args);
}

export async function signOut(...args: unknown[]) {
  return (await getAuthInstance()).signOut(...args);
}
