"use client";

import Link from "next/link";
import { toast } from "react-toastify";
import NavbarToggle from "@/components/Admin/NavbarToggle";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import Skeleton from "@/components/ui/Skeleton";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { Entitlements } from "@/lib/modules/billing/api";
import {
  useEntitlementsQuery,
  usePortalMutation,
} from "@/lib/modules/billing/hooks";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatAmount(minorUnits: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(minorUnits / 100);
  } catch {
    return `${(minorUnits / 100).toFixed(2)} ${currency}`;
  }
}

function SubscriptionStatus({ data }: { data: Entitlements }) {
  const sub = data.subscription;
  if (!sub) {
    return (
      <p className="text-sm text-off-dark dark:text-off-white">
        You&apos;re on the Free plan.
      </p>
    );
  }
  const periodEnd = formatDate(sub.currentPeriodEnd);
  const amount = formatAmount(sub.recurringAmount, sub.currency);

  if (sub.status === "on_hold" || sub.status === "past_due") {
    return (
      <div className="rounded-xl border border-red-light dark:border-red-dark bg-red-light/10 dark:bg-red-dark/10 p-4 text-sm text-dark dark:text-white">
        <p className="font-bold">Your last payment didn&apos;t go through.</p>
        <p className="mt-1">
          Your account is using Free limits until it does. Update your payment
          method to restore Pro right away.
        </p>
      </div>
    );
  }
  if (data.plan === "pro" && sub.cancelAtPeriodEnd) {
    return (
      <p className="text-sm text-dark dark:text-white">
        Cancelled — you keep Pro until <strong>{periodEnd}</strong>, then move
        to Free.
      </p>
    );
  }
  if (sub.status === "active") {
    return (
      <p className="text-sm text-dark dark:text-white">
        {amount} / month · renews on <strong>{periodEnd}</strong>
      </p>
    );
  }
  if (sub.status === "paused") {
    return (
      <p className="text-sm text-dark dark:text-white">
        Your subscription is paused. Resume it from the billing portal.
      </p>
    );
  }
  if (sub.status === "pending") {
    return (
      <p className="text-sm text-dark dark:text-white">
        Your subscription is being set up — this page updates once it&apos;s
        active.
      </p>
    );
  }
  return (
    <p className="text-sm text-off-dark dark:text-off-white">
      Your Pro subscription has ended. You&apos;re on the Free plan.
    </p>
  );
}

function UsageRow({
  label,
  value,
  hint,
  progress,
}: {
  label: string;
  value: string;
  hint?: string;
  progress?: { value: number; max: number };
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-bold text-dark dark:text-white">{label}</p>
        <p className="text-sm text-dark dark:text-white">{value}</p>
      </div>
      {progress && (
        <Progress
          className="mt-2"
          value={progress.value}
          max={progress.max}
          label={label}
        />
      )}
      {hint && (
        <p className="mt-1 text-xs text-off-dark dark:text-off-white">{hint}</p>
      )}
    </div>
  );
}

export default function BillingClient() {
  const { data, isPending, isError, error } = useEntitlementsQuery();
  const portal = usePortalMutation();

  function openPortal() {
    portal.mutate(undefined, {
      onSuccess: ({ url }) => window.location.assign(url),
      onError: (err) => toast.error(getApiErrorMessage(err)),
    });
  }

  return (
    <div className="w-full p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="md:hidden">
          <NavbarToggle />
        </span>
        <h1 className="text-2xl font-black text-dark dark:text-white">
          Plan & Billing
        </h1>
      </div>

      {isPending ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-40 w-full rounded-xl bg-white dark:bg-card-dark" />
          <Skeleton className="h-56 w-full rounded-xl bg-white dark:bg-card-dark" />
        </div>
      ) : isError || !data ? (
        <p className="text-dark dark:text-white">
          {getApiErrorMessage(error) || "Could not load your plan."}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  {data.plan === "pro" ? "Buzrr Pro" : "Free plan"}
                  <Badge tone={data.plan === "pro" ? "success" : "neutral"}>
                    {data.plan === "pro" ? "Pro" : "Free"}
                  </Badge>
                </span>
              }
              description="Your current plan and subscription."
            />
            <div className="mt-4 flex flex-col gap-4">
              {data.billingEnabled ? (
                <SubscriptionStatus data={data} />
              ) : (
                <p className="text-sm text-off-dark dark:text-off-white">
                  Billing isn&apos;t enabled on this Buzrr instance — every
                  account has Pro limits.
                </p>
              )}
              {data.billingEnabled && (
                <div className="flex flex-col sm:flex-row gap-3">
                  {data.plan === "free" &&
                    !(
                      data.subscription &&
                      ["on_hold", "past_due", "paused"].includes(
                        data.subscription.status,
                      )
                    ) && (
                      <Link
                        href="/billing/checkout"
                        className="inline-flex items-center justify-center rounded-xl px-5 py-3 font-bold bg-lprimary dark:bg-dprimary text-white dark:text-dark hover:opacity-90"
                      >
                        Upgrade to Pro
                      </Link>
                    )}
                  {data.subscription && (
                    <Button
                      variant={data.plan === "pro" ? "primary" : "outline"}
                      onClick={openPortal}
                      isLoading={portal.isPending}
                      loadingText="Opening portal…"
                    >
                      {data.subscription.status === "on_hold" ||
                      data.subscription.status === "past_due"
                        ? "Update payment method"
                        : "Manage subscription"}
                    </Button>
                  )}
                  {data.plan === "free" && (
                    <Link
                      href="/pricing"
                      className="inline-flex items-center justify-center px-5 py-3 text-sm font-bold text-lprimary dark:text-dprimary underline underline-offset-2"
                    >
                      Compare plans
                    </Link>
                  )}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Usage"
              description="What your plan allows and how much you've used."
            />
            <div className="mt-4 flex flex-col gap-5">
              <UsageRow
                label="Quizzes"
                value={
                  data.limits.maxQuizzes === null
                    ? `${data.usage.quizCount} · unlimited`
                    : `${data.usage.quizCount} / ${data.limits.maxQuizzes}`
                }
                progress={
                  data.limits.maxQuizzes === null
                    ? undefined
                    : {
                        value: data.usage.quizCount,
                        max: data.limits.maxQuizzes,
                      }
                }
                hint={
                  data.limits.maxQuizzes !== null &&
                  data.usage.quizCount >= data.limits.maxQuizzes
                    ? "You've hit the limit — delete a quiz or upgrade to create more. Existing quizzes can still be hosted."
                    : undefined
                }
              />
              <UsageRow
                label="AI generations"
                value={`${data.usage.aiTokensRemaining} of ${data.limits.ai.amount} left`}
                progress={{
                  value: data.usage.aiTokensUsed,
                  max: data.limits.ai.amount,
                }}
                hint={
                  data.limits.ai.kind === "lifetime"
                    ? "A one-time Free allowance. Pro includes 10 every week."
                    : data.usage.aiTokensResetAt
                      ? `Refills on ${formatDate(data.usage.aiTokensResetAt)}.`
                      : "Your 7-day window starts with your next generation."
                }
              />
              <UsageRow
                label="Players per room"
                value={`Up to ${data.limits.maxPlayers}`}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
