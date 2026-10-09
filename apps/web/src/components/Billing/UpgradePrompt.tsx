"use client";

import { Box, Modal } from "@mui/material";
import clsx from "clsx";
import Link from "next/link";
import { useCallback, useState } from "react";
import ModalCloseButton from "@/components/ModalCloseButton";
import { getPlanLimitError } from "@/lib/api/errors";
import type { PlanLimitDetails } from "@/lib/api/errors";
import { useEntitlementsQuery } from "@/lib/modules/billing/hooks";
import style from "@/utils/modalStyle";

function formatReset(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Shown when the API refuses an action with `code: "PLAN_LIMIT"`. A limit with
 * a `resetsAt` is a Pro user's weekly AI allowance — there's nothing to upgrade
 * to, so it only says when it refills.
 */
export default function UpgradePrompt({
  limit,
  onClose,
}: {
  limit: PlanLimitDetails | null;
  onClose: () => void;
}) {
  const weeklyRefill = limit?.resetsAt ?? null;
  const title =
    limit?.limit === "quizzes"
      ? "You've reached your quiz limit"
      : "You're out of AI generations";

  return (
    <Modal
      open={limit !== null}
      onClose={onClose}
      aria-labelledby="upgrade-prompt-title"
      aria-describedby="upgrade-prompt-desc"
    >
      <Box
        sx={style}
        className="bg-light-bg dark:bg-card-dark rounded-xl w-4/5 sm:w-3/5 md:w-2/5 max-w-[520px]"
      >
        <ModalCloseButton onClose={onClose} />
        <div className="p-6 flex flex-col">
          <p
            id="upgrade-prompt-title"
            className="text-xl font-bold mb-2 text-dark dark:text-white"
          >
            {title}
          </p>
          <p
            id="upgrade-prompt-desc"
            className="text-sm text-[#4E4E56] dark:text-off-white"
          >
            {limit?.message}
          </p>
          {weeklyRefill ? (
            <p className="mt-3 text-sm text-dark dark:text-white">
              Your generations refill on{" "}
              <strong>{formatReset(weeklyRefill)}</strong>.
            </p>
          ) : (
            <ul className="mt-4 space-y-1 text-sm text-dark dark:text-white list-disc pl-5">
              <li>Unlimited quizzes</li>
              <li>10 AI quiz generations every week</li>
              <li>Rooms of up to 250 players</li>
            </ul>
          )}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            {weeklyRefill ? (
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl px-5 py-3 font-bold bg-lprimary dark:bg-dprimary text-white dark:text-dark cursor-pointer"
              >
                Got it
              </button>
            ) : (
              <>
                <Link
                  href="/billing/checkout"
                  className="flex-1 text-center rounded-xl px-5 py-3 font-bold bg-lprimary dark:bg-dprimary text-white dark:text-dark hover:opacity-90"
                >
                  Upgrade to Pro
                </Link>
                <Link
                  href="/pricing"
                  className="flex-1 text-center rounded-xl px-5 py-3 font-bold border-2 border-lprimary dark:border-dprimary text-lprimary dark:text-dprimary"
                >
                  See plans
                </Link>
              </>
            )}
          </div>
        </div>
      </Box>
    </Modal>
  );
}

/**
 * `handlePlanLimit(err)` opens the prompt and returns true for plan-limit
 * errors, so callers only toast the errors it didn't handle.
 */
export function usePlanLimitPrompt() {
  const [limit, setLimit] = useState<PlanLimitDetails | null>(null);
  const handlePlanLimit = useCallback((err: unknown) => {
    const details = getPlanLimitError(err);
    if (details) setLimit(details);
    return details !== null;
  }, []);
  const upgradePrompt = (
    <UpgradePrompt limit={limit} onClose={() => setLimit(null)} />
  );
  return { handlePlanLimit, upgradePrompt };
}

/** Remaining AI generations, next to the controls that spend them. */
/** AI generation quota as a labelled progress bar (AI quiz modal). */
export function AiQuotaBar({ className }: { className?: string }) {
  const { data } = useEntitlementsQuery();
  if (!data) return null;
  const { aiTokensRemaining, aiTokensResetAt } = data.usage;
  const { amount, kind } = data.limits.ai;
  const period =
    kind === "lifetime"
      ? " (one-time)"
      : aiTokensResetAt
        ? ` this week · refills ${new Date(aiTokensResetAt).toLocaleDateString()}`
        : " this week";
  const pct =
    amount > 0 ? Math.min(100, (aiTokensRemaining / amount) * 100) : 0;
  const empty = aiTokensRemaining === 0;
  return (
    <div
      className={clsx(
        "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] bg-lprimary/8 dark:bg-white/5",
        empty
          ? "text-red-light dark:text-red-dark"
          : "text-off-dark dark:text-muted-dark",
        className,
      )}
    >
      <span>
        <b className={empty ? "" : "text-dark dark:text-white"}>
          {aiTokensRemaining} of {amount}
        </b>{" "}
        AI generations left{period}
      </span>
      <span className="flex-1 min-w-12 h-1.5 rounded-md overflow-hidden bg-lprimary/15 dark:bg-white/10">
        <i
          className="block h-full bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] dark:from-accent dark:to-accent-deep"
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  );
}

export function AiTokenBalance({ className }: { className?: string }) {
  const { data } = useEntitlementsQuery();
  if (!data) return null;
  const { aiTokensRemaining, aiTokensResetAt } = data.usage;
  const { amount, kind } = data.limits.ai;
  const suffix =
    kind === "lifetime"
      ? " (one-time)"
      : aiTokensResetAt
        ? ` this week · refills ${new Date(aiTokensResetAt).toLocaleDateString()}`
        : " this week";
  return (
    <p
      className={clsx(
        "text-xs",
        aiTokensRemaining === 0
          ? "text-red-light dark:text-red-dark font-bold"
          : "text-off-dark dark:text-off-white",
        className,
      )}
    >
      {aiTokensRemaining} of {amount} AI generations left{suffix}
    </p>
  );
}
