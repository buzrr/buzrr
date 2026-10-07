import "server-only";

export interface AuthMethods {
  /** Google OAuth — needs GOOGLE_CLIENT_ID/SECRET (and the internet). */
  google: boolean;
  /** Local accounts with a password — works fully offline. */
  emailPassword: boolean;
  /** Whether new local accounts may register themselves. */
  emailSignUp: boolean;
}

/**
 * Which sign-in methods this deployment offers, from env at request time.
 * Google is on when its credentials are set; email + password is opt-in with
 * `AUTH_EMAIL_PASSWORD=ON` (the self-hosting path — no third party at all),
 * and `AUTH_EMAIL_SIGNUP=OFF` closes self-registration once the accounts a
 * school needs exist.
 */
export function getAuthMethods(): AuthMethods {
  const emailPassword = process.env.AUTH_EMAIL_PASSWORD?.toUpperCase() === "ON";
  return {
    google: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    ),
    emailPassword,
    emailSignUp:
      emailPassword && process.env.AUTH_EMAIL_SIGNUP?.toUpperCase() !== "OFF",
  };
}
