"use client";

import clsx from "clsx";
import { LuTag } from "react-icons/lu";
import Skeleton from "@/components/ui/Skeleton";
import type { DiscountSummary } from "@/lib/modules/billing/api";
import { formatMoney } from "@/lib/pricing";

export function discountLabel(discount: DiscountSummary): string {
  const off = `${discount.percentOff}% off`;
  const cycles = discount.subscriptionCycles;
  const span = cycles
    ? ` for ${cycles === 1 ? "your first month" : `${cycles} months`}`
    : "";
  const ends = discount.expiresAt
    ? ` · ends ${new Date(discount.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
    : "";
  return `${off}${span}${ends}`;
}

/**
 * The Pro price as the headline, in the visitor's currency. With a discount the
 * list price is struck through next to the first-cycle price.
 */
export default function ProPrice({
  currency,
  amount,
  discount,
  loading,
  size = "lg",
}: {
  currency: string;
  amount: number;
  discount: DiscountSummary | null;
  loading?: boolean;
  size?: "lg" | "md";
}) {
  if (loading) {
    return (
      <Skeleton
        className={clsx(
          "rounded-lg bg-card-light dark:bg-dark",
          size === "lg" ? "h-10 w-40" : "h-8 w-32",
        )}
      />
    );
  }

  const discounted = discount?.discountedAmount ?? null;
  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-2 text-dark dark:text-white">
        {discounted !== null && (
          <span className="text-lg font-bold text-off-dark dark:text-off-white line-through">
            {formatMoney(amount, currency)}
          </span>
        )}
        <span
          className={clsx(
            "font-black",
            size === "lg" ? "text-4xl" : "text-3xl",
          )}
        >
          {formatMoney(discounted ?? amount, currency)}
        </span>
        <span className="text-sm text-off-dark dark:text-off-white">
          / month
        </span>
      </p>
      {discount && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#20A97C]/15 px-2.5 py-1 text-xs font-bold text-[#20A97C]">
          <LuTag size={12} />
          {discountLabel(discount)}
        </p>
      )}
    </div>
  );
}
