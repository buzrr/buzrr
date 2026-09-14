import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
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
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    trustedOrigins: process.env.TRUSTED_ORIGINS?.split(",") ?? [],
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
    user: {
      // Powers the settings danger-zone "Delete profile" flow; related rows
      // (quizzes, sessions, accounts, …) go with the user via FK cascades.
      deleteUser: {
        enabled: true,
        // A subscription that will still renew would keep billing an account
        // that no longer exists, so it has to be cancelled first. Read-only
        // check; billing writes stay in the API.
        beforeDelete: async (user) => {
          const renewing = await prisma.subscription.count({
            where: {
              userId: user.id,
              status: { in: ["active", "on_hold", "past_due", "paused"] },
              cancelAtPeriodEnd: false,
            },
          });
          if (renewing > 0) {
            throw new APIError("BAD_REQUEST", {
              message:
                "Cancel your Buzrr Pro subscription from Plan & Billing before deleting your profile.",
            });
          }
        },
      },
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
