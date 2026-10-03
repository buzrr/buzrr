"use client";

import { isAxiosError } from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LuCheck, LuLock, LuX } from "react-icons/lu";
import { toast } from "react-toastify";
import ProPrice, { discountLabel } from "@/components/Pricing/ProPrice";
import { Button } from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { usePriceRegion } from "@/hooks/usePriceRegion";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { DiscountSummary } from "@/lib/modules/billing/api";
import {
  useCreateCheckoutMutation,
  useEntitlementsQuery,
  useProPricingQuery,
  useValidateDiscountMutation,
} from "@/lib/modules/billing/hooks";
import { FALLBACK_PRICING, PLAN_COPY } from "@/lib/pricing";
import type { PriceRegion } from "@/lib/pricing";

const FEATURES = [
  `Up to ${PLAN_COPY.pro.maxPlayers} players per room`,
  "Unlimited quizzes",
  `${PLAN_COPY.pro.aiTokensPerWeek} AI quiz generations every week`,
];

export default function CheckoutClient({
  email,
  serverRegion,
}: {
  email: string;
  serverRegion: PriceRegion | null;
}) {
  const router = useRouter();
  const { region, resolved } = usePriceRegion(serverRegion);
  const pricingQuery = useProPricingQuery(region, resolved);
  const { data: entitlements, isPending } = useEntitlementsQuery();
  const checkout = useCreateCheckoutMutation();
  const validate = useValidateDiscountMutation();

  const [codeOpen, setCodeOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  // A code the customer entered and the API accepted; replaces the promotion.
  const [appliedCode, setAppliedCode] = useState<DiscountSummary | null>(null);

  const pricing = pricingQuery.data;
  const currency = pricing?.currency ?? FALLBACK_PRICING[region].currency;
  const amount = pricing?.amount ?? FALLBACK_PRICING[region].amount;
  const discount = appliedCode ?? pricing?.discount ?? null;

  function applyCode(event: React.FormEvent) {
    event.preventDefault();
    const code = codeInput.trim();
    if (!code) return;
    validate.mutate(
      { code, region },
      {
        onSuccess: (summary) => {
          setAppliedCode(summary);
          setCodeOpen(false);
          toast.success(`${summary.code} applied`);
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );
  }

  function startCheckout() {
    checkout.mutate(
      { discountCode: appliedCode?.code ?? undefined },
      {
        onSuccess: ({ checkoutUrl }) => {
          // Hosted Dodo checkout. Pro is granted only once the verified
          // webhook confirms the subscription — never by coming back here.
          window.location.assign(checkoutUrl);
        },
        onError: (err) => {
          if (isAxiosError(err) && err.response?.status === 409) {
            toast.info("You already have Buzrr Pro.");
            router.push("/admin/billing");
            return;
          }
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  }

  if (isPending) {
    return (
      <div className="max-w-lg mx-auto">
        <Skeleton className="h-96 w-full rounded-2xl bg-white dark:bg-card-dark" />
      </div>
    );
  }

  const alreadyPro =
    entitlements?.billingEnabled && entitlements.plan === "pro";
  const billingOff = entitlements ? !entitlements.billingEnabled : false;
  const canPay = !billingOff && !alreadyPro;

  return (
    <div className="max-w-lg mx-auto animate-fade-up">
      <h1 className="text-3xl font-black text-dark dark:text-white text-center">
        Upgrade to Buzrr Pro
      </h1>
      <p className="mt-2 text-center text-off-dark dark:text-off-white">
        Review your plan, then pay securely with Dodo Payments.
      </p>

      <section className="mt-8 rounded-2xl bg-white dark:bg-card-dark p-6 md:p-8 border-2 border-lprimary dark:border-dprimary">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-dark dark:text-white">
              Buzrr Pro
            </h2>
            <p className="text-xs text-off-dark dark:text-off-white">
              Monthly subscription
            </p>
          </div>
          <ProPrice
            size="md"
            currency={currency}
            amount={amount}
            discount={discount}
            loading={!resolved || pricingQuery.isPending}
          />
        </div>

        <ul className="mt-6 space-y-2">
          {FEATURES.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-2 text-sm text-dark dark:text-white"
            >
              <LuCheck
                size={16}
                className="shrink-0 text-lprimary dark:text-dprimary"
              />
              {feature}
            </li>
          ))}
        </ul>

        <dl className="mt-6 border-t border-card-light dark:border-dark pt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-off-dark dark:text-off-white">Account</dt>
            <dd className="font-bold text-dark dark:text-white truncate">
              {email}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-off-dark dark:text-off-white">Billed</dt>
            <dd className="font-bold text-dark dark:text-white">
              Monthly · cancel anytime
            </dd>
          </div>
          {discount && (
            <div className="flex justify-between gap-4">
              <dt className="text-off-dark dark:text-off-white">Discount</dt>
              <dd className="flex items-center gap-2 font-bold text-dark dark:text-white text-right">
                <span>
                  {discount.code ? `${discount.code} — ` : ""}
                  {discountLabel(discount)}
                </span>
                {appliedCode && (
                  <button
                    type="button"
                    aria-label="Remove discount code"
                    onClick={() => setAppliedCode(null)}
                    className="text-off-dark dark:text-off-white hover:text-red-light cursor-pointer"
                  >
                    <LuX size={14} />
                  </button>
                )}
              </dd>
            </div>
          )}
        </dl>

        {canPay &&
          (codeOpen ? (
            <form onSubmit={applyCode} className="mt-4 flex gap-2">
              <input
                autoFocus
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Discount code"
                maxLength={64}
                aria-label="Discount code"
                className="flex-1 rounded-xl border border-gray bg-white dark:bg-dark text-dark dark:text-white px-4 py-2 text-sm outline-none focus:border-lprimary dark:focus:border-dprimary"
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                isLoading={validate.isPending}
                loadingText="Checking…"
                disabled={!codeInput.trim()}
              >
                Apply
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCodeOpen(true)}
              className="mt-4 text-sm font-bold text-lprimary dark:text-dprimary underline underline-offset-2 cursor-pointer"
            >
              Have a discount code?
            </button>
          ))}

        {billingOff ? (
          <p className="mt-6 rounded-xl bg-card-light dark:bg-dark p-4 text-sm text-dark dark:text-white">
            Billing isn&apos;t enabled on this Buzrr instance — every account
            already has Pro limits.
          </p>
        ) : alreadyPro ? (
          <Link
            href="/admin/billing"
            className="mt-6 flex w-full items-center justify-center rounded-xl px-5 py-3 font-bold border-2 border-lprimary dark:border-dprimary text-lprimary dark:text-dprimary"
          >
            You&apos;re on Pro — manage your plan
          </Link>
        ) : (
          <Button
            fullWidth
            className="mt-6"
            onClick={startCheckout}
            isLoading={checkout.isPending || checkout.isSuccess}
            loadingText="Redirecting to secure checkout…"
            leftIcon={<LuLock size={16} />}
          >
            Continue to secure payment
          </Button>
        )}

        <p className="mt-4 text-xs text-center text-off-dark dark:text-off-white">
          {pricing?.taxInclusive
            ? "Price includes applicable taxes."
            : "Any taxes are added at checkout."}
        </p>
        <p className="mt-2 text-xs text-center text-off-dark dark:text-off-white">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2">
            Terms
          </Link>
          . Payments are non-refundable; if you cancel, Pro stays active until
          the end of the paid month. See the{" "}
          <Link href="/refund-policy" className="underline underline-offset-2">
            Refund Policy
          </Link>
          .
        </p>
      </section>

      <p className="mt-6 text-center text-sm">
        <Link
          href="/pricing"
          className="text-lprimary dark:text-dprimary underline underline-offset-2"
        >
          Back to pricing
        </Link>
      </p>
    </div>
  );
}
