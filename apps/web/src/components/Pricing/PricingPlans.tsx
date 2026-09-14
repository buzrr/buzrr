"use client";

import clsx from "clsx";
import Link from "next/link";
import { LuCheck } from "react-icons/lu";
import { Badge } from "@/components/ui/Badge";
import ProPrice from "@/components/Pricing/ProPrice";
import { usePriceRegion } from "@/hooks/usePriceRegion";
import {
  useEntitlementsQuery,
  useProPricingQuery,
} from "@/lib/modules/billing/hooks";
import { FALLBACK_PRICING, PLAN_COPY, formatMoney } from "@/lib/pricing";
import type { PriceRegion } from "@/lib/pricing";

const CHECKOUT_PATH = "/billing/checkout";

const ctaBase =
  "mt-8 flex w-full items-center justify-center rounded-xl px-5 py-3 font-bold transition-opacity";
const ctaPrimary = `${ctaBase} bg-lprimary dark:bg-dprimary text-white dark:text-dark hover:opacity-90`;
const ctaOutline = `${ctaBase} border-2 border-lprimary dark:border-dprimary text-lprimary dark:text-dprimary hover:opacity-80`;
const ctaDisabled = `${ctaBase} bg-gray/30 text-off-dark dark:text-off-white cursor-default`;

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-2 text-sm text-dark dark:text-white"
        >
          <LuCheck
            size={18}
            className="mt-0.5 shrink-0 text-lprimary dark:text-dprimary"
          />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function PricingPlans({
  serverRegion,
  signedIn,
}: {
  serverRegion: PriceRegion | null;
  signedIn: boolean;
}) {
  const { region, resolved } = usePriceRegion(serverRegion);
  const pricingQuery = useProPricingQuery(region, resolved);
  const pricing = pricingQuery.data;
  // Until the live price arrives (or if it fails) show the regional default.
  const currency = pricing?.currency ?? FALLBACK_PRICING[region].currency;
  const amount = pricing?.amount ?? FALLBACK_PRICING[region].amount;
  const priceLoading = !resolved || pricingQuery.isPending;

  const { data: entitlements } = useEntitlementsQuery({ enabled: signedIn });
  const plan = entitlements?.plan;
  const billingOff = entitlements ? !entitlements.billingEnabled : false;

  const proCta = (() => {
    if (!signedIn) {
      return (
        <Link
          href={`/auth/login?callbackURL=${encodeURIComponent(CHECKOUT_PATH)}`}
          className={ctaPrimary}
        >
          Get Buzrr Pro
        </Link>
      );
    }
    if (billingOff) {
      return (
        <span className={ctaDisabled}>Not available on this instance</span>
      );
    }
    if (plan === "pro") {
      return (
        <Link href="/admin/billing" className={ctaOutline}>
          Manage your plan
        </Link>
      );
    }
    return (
      <Link href={CHECKOUT_PATH} className={ctaPrimary}>
        Upgrade to Pro
      </Link>
    );
  })();

  return (
    <div className="mt-12 grid gap-6 md:grid-cols-2">
      <section className="rounded-2xl bg-white dark:bg-card-dark p-6 md:p-8 border border-card-light dark:border-card-dark">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-dark dark:text-white">Free</h2>
          {signedIn && plan === "free" && <Badge>Your plan</Badge>}
        </div>
        <p className="mt-1 text-sm text-off-dark dark:text-off-white">
          Everything you need to run your first games.
        </p>
        <p className="mt-6 text-dark dark:text-white">
          <span className="text-4xl font-black">
            {resolved ? formatMoney(0, currency) : " "}
          </span>
          <span className="text-sm text-off-dark dark:text-off-white">
            {" "}
            / forever
          </span>
        </p>
        <FeatureList
          items={[
            `Up to ${PLAN_COPY.free.maxPlayers} players per room`,
            `Up to ${PLAN_COPY.free.maxQuizzes} quizzes`,
            `${PLAN_COPY.free.aiTokens} AI quiz generations (one-time)`,
            "Ranked 1v1 duels and friend challenges",
            "Join by code, link or QR",
          ]}
        />
        <Link href={signedIn ? "/admin" : "/auth/login"} className={ctaOutline}>
          {signedIn ? "Go to your quizzes" : "Start for free"}
        </Link>
      </section>

      <section
        className={clsx(
          "relative rounded-2xl bg-white dark:bg-card-dark p-6 md:p-8 border-2",
          "border-lprimary dark:border-dprimary shadow-lg",
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-dark dark:text-white">
            Buzrr Pro
          </h2>
          {signedIn && plan === "pro" ? (
            <Badge tone="success">Your plan</Badge>
          ) : (
            <Badge tone="info">For hosts & classrooms</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-off-dark dark:text-off-white">
          Bigger rooms, no quiz cap, weekly AI.
        </p>
        <div className="mt-6">
          <ProPrice
            currency={currency}
            amount={amount}
            discount={pricing?.discount ?? null}
            loading={priceLoading}
          />
        </div>
        <FeatureList
          items={[
            `Up to ${PLAN_COPY.pro.maxPlayers} players per room`,
            "Unlimited quizzes",
            `${PLAN_COPY.pro.aiTokensPerWeek} AI quiz generations every week`,
            "Everything in Free",
            "Cancel anytime — keep Pro until your period ends",
          ]}
        />
        {proCta}
      </section>
    </div>
  );
}
