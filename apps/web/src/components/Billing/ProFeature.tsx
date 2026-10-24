"use client";

import Link from "next/link";
import { LuLock } from "react-icons/lu";
import { useEntitlementsQuery } from "@/lib/modules/billing/hooks";
import { useT } from "@/lib/i18n/context";

/**
 * Own audio skins, own avatar skins and logos are Pro features; without
 * billing every account has them. Undefined while loading (show nothing yet).
 */
export function useHasPro(): boolean | undefined {
  const { data } = useEntitlementsQuery();
  if (!data) return undefined;
  return !data.billingEnabled || data.plan === "pro";
}

/** "Pro" lock with a link to the plans, in place of a Pro-only control. */
export function ProLock({ what }: { what?: string }) {
  const t = useT();
  return (
    <Link
      href="/pricing"
      className="inline-flex items-center gap-1.5 rounded-full bg-[#f4c542]/20 px-3 py-1 text-xs font-bold text-[#9a6b00] dark:text-[#f4c542] hover:underline whitespace-nowrap"
      title={what ? t("{what} is a Pro feature", { what }) : undefined}
    >
      <LuLock size={12} />
      {t("Pro")}
    </Link>
  );
}
