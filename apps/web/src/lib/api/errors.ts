import axios from "axios";

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string | string[] }
      | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join(", ");
    if (typeof msg === "string") return msg;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong";
}

export type PlanLimitDetails = {
  message: string;
  limit: "quizzes" | "ai_tokens";
  max?: number;
  resetsAt?: string | null;
};

/**
 * A plan-allowance refusal (`code: "PLAN_LIMIT"`) from either the Nest API or
 * Buzrr-AI, which passes Nest's body through. `null` for any other error.
 */
export function getPlanLimitError(error: unknown): PlanLimitDetails | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 403) {
    return null;
  }
  const data = error.response.data as
    | (Partial<PlanLimitDetails> & { code?: string })
    | undefined;
  if (data?.code !== "PLAN_LIMIT" || !data.limit) return null;
  return {
    message:
      typeof data.message === "string" ? data.message : "Plan limit reached",
    limit: data.limit,
    max: data.max,
    resetsAt: data.resetsAt ?? null,
  };
}
