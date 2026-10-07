import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { prisma } from "@buzrr/prisma";
import { getAuthMethods } from "./auth-methods";

type Auth = ReturnType<typeof betterAuth>;

let _auth: Auth | undefined;

function getAuth(): Auth {
  if (_auth) return _auth;

  const methods = getAuthMethods();
  if (!methods.google && !methods.emailPassword) {
    throw new Error(
      "No sign-in method configured: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or AUTH_EMAIL_PASSWORD=ON for local accounts",
    );
  }

  _auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    trustedOrigins: process.env.TRUSTED_ORIGINS?.split(",") ?? [],
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    socialProviders: methods.google
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : {},
    // Local accounts for installs with no Google (or no internet). No email
    // verification: an offline server has no way to send mail.
    emailAndPassword: {
      enabled: methods.emailPassword,
      disableSignUp: !methods.emailSignUp,
      minPasswordLength: 8,
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
