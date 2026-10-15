"use client";

import Image from "next/image";
import Link from "next/link";
import type { DuelProfile, DuelRecord } from "@buzrr/contract";
import { DEFAULT_AVATAR } from "@/constants";

const EMPTY: DuelRecord = {
  rating: 1200,
  ratedDuels: 0,
  wins: 0,
  losses: 0,
  draws: 0,
};

/** The record for one category (null = Random), or a fresh one. */
export function recordFor(
  profile: DuelProfile,
  categoryId: string | null,
): DuelRecord {
  if (!categoryId) return profile.random;
  return profile.categories.find((c) => c.categoryId === categoryId) ?? EMPTY;
}

const played = (r: DuelRecord) => r.wins + r.losses + r.draws;

/**
 * Rating and record for the selected category — each category has its own
 * rating, Random uses the global one. `compact` is the slim mobile row.
 */
export default function DuelProfileCard({
  profile,
  categoryId,
  categoryName,
  compact = false,
}: {
  profile: DuelProfile;
  categoryId: string | null;
  categoryName: string;
  compact?: boolean;
}) {
  const record = recordFor(profile, categoryId);
  const duels = played(record);
  // Re-keying on the category replays the fade when the selection changes.
  const rating = (
    <div
      key={categoryId ?? "random"}
      className="ml-auto text-right leading-tight animate-[fade-up_0.3s_ease-out_both]"
    >
      <b
        className={
          compact
            ? "block text-[22px] font-extrabold text-lprimary dark:text-dprimary"
            : "block text-[28px] sm:text-4xl font-extrabold leading-none text-lprimary dark:text-dprimary"
        }
      >
        {record.rating}
      </b>
      <span className="text-[11.5px] sm:text-sm text-off-dark dark:text-muted-dark">
        {compact
          ? record.ratedDuels
            ? "rating"
            : "starting"
          : record.ratedDuels
            ? `${categoryName} rating`
            : "starting rating"}
      </span>
    </div>
  );

  if (compact) {
    return (
      <Link
        href="/duel/profile"
        className="flex items-center gap-3 rounded-2xl border border-lprimary/15 dark:border-white/5 bg-white dark:bg-dark px-3.5 py-2.5"
      >
        <Image
          src={profile.image || DEFAULT_AVATAR}
          width={36}
          height={36}
          alt=""
          className="h-9 w-9 rounded-full"
        />
        <div className="flex min-w-0 flex-col">
          <b className="text-[15px] text-dark dark:text-white">
            {profile.name ?? "Player"}
          </b>
          <span className="truncate text-[12.5px] text-off-dark dark:text-muted-dark">
            {duels
              ? `${record.wins}W · ${record.losses}L in ${categoryName}`
              : `No ${categoryName} duels yet`}
          </span>
        </div>
        {rating}
      </Link>
    );
  }

  return (
    <Link
      href="/duel/profile"
      aria-label="Open your profile"
      className="block rounded-[22px] border border-lprimary/15 dark:border-white/5 bg-white dark:bg-dark px-[18px] py-4 sm:px-[26px] sm:py-[22px] shadow-[0_10px_30px_-18px_rgba(70,40,160,0.35)] transition-colors hover:border-lprimary/40 dark:hover:border-dprimary/40"
    >
      <div className="flex items-center gap-[18px]">
        <Image
          src={profile.image || DEFAULT_AVATAR}
          width={72}
          height={72}
          alt=""
          className="h-[54px] w-[54px] rounded-full sm:h-[72px] sm:w-[72px]"
        />
        <div>
          <div className="text-lg sm:text-[21px] font-bold text-dark dark:text-white">
            {profile.name ?? "Player"}
          </div>
          <div className="text-sm sm:text-[14.5px] text-off-dark dark:text-muted-dark">
            {duels
              ? `${duels} ${categoryName} duel${duels === 1 ? "" : "s"}`
              : `No ${categoryName} duels yet`}
          </div>
        </div>
        {rating}
      </div>
      <div className="mt-[18px] grid grid-cols-3 border-t border-lprimary/15 dark:border-white/5 pt-4">
        <Stat value={String(duels)} label="Duels" />
        <Stat
          value={`${record.wins}W · ${record.losses}L`}
          label="Record"
          divided
        />
        <Stat
          value={duels ? `${Math.round((record.wins / duels) * 100)}%` : "–"}
          label="Win rate"
          divided
        />
      </div>
    </Link>
  );
}

function Stat({
  value,
  label,
  divided = false,
}: {
  value: string;
  label: string;
  divided?: boolean;
}) {
  return (
    <div
      className={
        divided
          ? "flex flex-col gap-0.5 border-l border-lprimary/15 dark:border-white/5 pl-3 sm:pl-[18px]"
          : "flex flex-col gap-0.5 px-1"
      }
    >
      <b className="text-[17px] sm:text-xl font-extrabold text-dark dark:text-white">
        {value}
      </b>
      <span className="text-xs sm:text-[13px] text-off-dark dark:text-muted-dark">
        {label}
      </span>
    </div>
  );
}
