"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LuCircleCheck, LuLoader } from "react-icons/lu";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/Button";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  useEntitlementsQuery,
  useSyncBillingMutation,
} from "@/lib/modules/billing/hooks";

const POLL_MS = 2_000;
const WAIT_MS = 60_000;

export default function CheckoutSuccessClient() {
  const [timedOut, setTimedOut] = useState(false);
  const sync = useSyncBillingMutation();
  const { data } = useEntitlementsQuery({
    refetchInterval: (latest) =>
      latest?.plan === "pro" || timedOut ? false : POLL_MS,
  });

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), WAIT_MS);
    return () => clearTimeout(timer);
  }, []);

  const isPro = data?.billingEnabled && data.plan === "pro";

  if (isPro) {
    return (
      <div className="max-w-lg mx-auto text-center animate-pop-in">
        <LuCircleCheck
          size={56}
          className="mx-auto text-lprimary dark:text-dprimary"
        />
        <h1 className="mt-4 text-3xl font-black text-dark dark:text-white">
          Welcome to Buzrr Pro
        </h1>
        <p className="mt-2 text-off-dark dark:text-off-white">
          Your rooms now hold up to {data.limits.maxPlayers} players, your quiz
          library is unlimited and you have {data.usage.aiTokensRemaining} AI
          generations ready this week.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/admin"
            className="rounded-xl px-5 py-3 font-bold bg-lprimary dark:bg-dprimary text-white dark:text-dark hover:opacity-90"
          >
            Go to your quizzes
          </Link>
          <Link
            href="/admin/billing"
            className="rounded-xl px-5 py-3 font-bold border-2 border-lprimary dark:border-dprimary text-lprimary dark:text-dprimary"
          >
            View plan & billing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto text-center">
      {!timedOut ? (
        <>
          <LuLoader
            size={48}
            className="mx-auto animate-spin text-lprimary dark:text-dprimary"
          />
          <h1 className="mt-4 text-3xl font-black text-dark dark:text-white">
            Confirming your payment…
          </h1>
          <p className="mt-2 text-off-dark dark:text-off-white">
            This usually takes a few seconds. Keep this page open — it updates
            by itself once your subscription is active.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-black text-dark dark:text-white">
            Still confirming your subscription
          </h1>
          <p className="mt-2 text-off-dark dark:text-off-white">
            If you completed payment, activation can take a minute or two. You
            won&apos;t be charged twice — check again, or come back later from
            your billing page. If you cancelled checkout, nothing was charged.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              isLoading={sync.isPending}
              loadingText="Checking…"
              onClick={() =>
                sync.mutate(undefined, {
                  onSuccess: (latest) => {
                    if (latest.plan !== "pro") {
                      toast.info(
                        "No active subscription yet. If you just paid, try again shortly.",
                      );
                    }
                  },
                  onError: (err) => toast.error(getApiErrorMessage(err)),
                })
              }
            >
              Check again
            </Button>
            <Link
              href="/pricing"
              className="rounded-xl px-5 py-3 font-bold border-2 border-lprimary dark:border-dprimary text-lprimary dark:text-dprimary"
            >
              Back to pricing
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
