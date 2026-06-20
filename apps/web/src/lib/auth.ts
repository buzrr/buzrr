import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@buzrr/prisma";

type Auth = ReturnType<typeof betterAuth>;

let _auth: Auth | undefined;

function getAuth(): Auth {
  if (_auth) return _auth;

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "Missing required Google OAuth credentials: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set",
    );
  }

  _auth = betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    },
    session: {
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
  }) as unknown as Auth;

  return _auth!;
}

export const auth = new Proxy({} as Auth, {
  get(_target, prop) {
    return getAuth()[prop as keyof Auth];
  },
  has(_target, prop) {
    return prop in getAuth();
  },
});
