"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/duel-portal", label: "Questions" },
  { href: "/admin/duel-portal/upload", label: "Bulk upload" },
  { href: "/admin/duel-portal/categories", label: "Categories" },
] as const;

export default function DuelPortalTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Duel Portal sections"
      className="mt-3 flex gap-1 overflow-x-auto border-b border-gray"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
              active
                ? "border-lprimary dark:border-dprimary text-lprimary dark:text-dprimary"
                : "border-transparent text-off-dark dark:text-off-white hover:text-dark dark:hover:text-white",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
