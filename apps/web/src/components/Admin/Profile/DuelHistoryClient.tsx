"use client";

import Link from "next/link";
import NavbarToggle from "@/components/Admin/NavbarToggle";
import DuelHistoryList from "./DuelHistoryList";

export default function DuelHistoryClient() {
  return (
    <div className="w-full p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="md:hidden">
          <NavbarToggle />
        </span>
        <h1 className="text-2xl font-black text-dark dark:text-white">
          Duel History
        </h1>
      </div>
      <Link
        href="/admin/profile"
        className="inline-block mb-4 text-sm text-lprimary dark:text-dprimary font-bold hover:underline"
      >
        ← Back to profile
      </Link>
      <DuelHistoryList limit={50} />
    </div>
  );
}
