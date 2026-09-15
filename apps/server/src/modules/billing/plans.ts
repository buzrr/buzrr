/**
 * The single table of plan limits. Every enforcement point reads from here via
 * `EntitlementsService` — never hardcode a limit at a call site.
 */
export type PlanId = "free" | "pro";

export type AiAllowance =
  /** A one-time allowance that never refills. */
  | { kind: "lifetime"; amount: number }
  /** Refills on a rolling 7-day window anchored at the first use after expiry. */
  | { kind: "weekly"; amount: number };

export type PlanLimits = {
  maxPlayers: number;
  /** `null` = unlimited. */
  maxQuizzes: number | null;
  ai: AiAllowance;
};

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: { maxPlayers: 50, maxQuizzes: 10, ai: { kind: "lifetime", amount: 3 } },
  pro: {
    maxPlayers: 250,
    maxQuizzes: null,
    ai: { kind: "weekly", amount: 10 },
  },
};

export const PRO_AI_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
