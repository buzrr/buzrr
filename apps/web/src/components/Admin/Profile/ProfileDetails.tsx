"use client";

import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import Skeleton from "@/components/ui/Skeleton";
import { DEFAULT_AVATAR } from "@/constants";
import { authClient } from "@/lib/auth-client";
import { useCurrentRole } from "@/components/SessionProvider";
import { useDuelProfileQuery } from "@/lib/modules/duel/hooks";
import { useMyStatsQuery } from "@/lib/modules/users/hooks";
import DuelHistoryList from "./DuelHistoryList";

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-card-dark rounded-xl p-4">
      <p className="text-2xl font-black text-lprimary dark:text-dprimary">
        {value}
      </p>
      <p className="text-xs text-off-dark dark:text-off-white mt-1">{label}</p>
    </div>
  );
}

function StatGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-20 w-full rounded-xl bg-white dark:bg-card-dark"
        />
      ))}
    </div>
  );
}

function IdentityCard() {
  const { data: session } = authClient.useSession();
  const role = useCurrentRole();

  if (!session) {
    return (
      <Skeleton className="h-28 w-full rounded-xl bg-white dark:bg-card-dark" />
    );
  }

  return (
    <div className="bg-white dark:bg-card-dark rounded-xl p-6 flex items-center gap-4">
      <Image
        src={session.user.image || DEFAULT_AVATAR}
        className="rounded-full shrink-0"
        alt="Profile Picture"
        width={72}
        height={72}
      />
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xl font-black text-dark dark:text-white truncate">
            {session.user.name}
          </p>
          <span
            className={clsx(
              "text-xs font-bold px-2 py-0.5 rounded-full capitalize",
              role === "user"
                ? "border border-gray text-off-dark dark:text-off-white"
                : "bg-lprimary dark:bg-dprimary text-white dark:text-dark",
            )}
          >
            {role}
          </span>
        </div>
        <p className="text-sm text-off-dark dark:text-off-white truncate">
          {session.user.email}
        </p>
        <p className="text-xs text-off-dark dark:text-off-white mt-1">
          Joined {new Date(session.user.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

function DuelStats() {
  const { data: profile, isPending, isError } = useDuelProfileQuery();

  if (isPending) {
    return <StatGridSkeleton count={2} />;
  }
  if (isError || !profile) {
    return (
      <p className="text-dark dark:text-white">
        Could not load your duel stats. Try again later.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <StatTile label="Elo rating" value={profile.eloRating} />
      <StatTile label="Duels played" value={profile.duelsPlayed} />
    </div>
  );
}

function ActivityStats() {
  const { data: stats, isPending, isError } = useMyStatsQuery();

  if (isPending) {
    return <StatGridSkeleton count={6} />;
  }
  if (isError || !stats) {
    return (
      <p className="text-dark dark:text-white">
        Could not load your activity stats. Try again later.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <StatTile label="Quizzes created" value={stats.quizzesCreated} />
      <StatTile label="Games hosted" value={stats.gamesHosted} />
      <StatTile label="Games played" value={stats.gamesPlayed} />
      <StatTile label="Wins" value={stats.wins} />
      <StatTile
        label="Win rate"
        value={`${Math.round(stats.winRate * 100)}%`}
      />
      <StatTile label="Avg score" value={stats.avgScore} />
    </div>
  );
}

function RecentDuels() {
  return (
    <div className="flex flex-col gap-3">
      <DuelHistoryList />
      <Link
        href="/admin/profile/duels"
        className="text-sm text-lprimary dark:text-dprimary font-bold hover:underline w-fit"
      >
        View full duel history →
      </Link>
    </div>
  );
}

/** Full profile content (identity + stats + recent duels), reusable outside the admin shell. */
export default function ProfileDetails() {
  return (
    <div className="flex flex-col gap-6">
      <IdentityCard />
      <section>
        <h2 className="text-lg font-black text-dark dark:text-white mb-3">
          Duel stats
        </h2>
        <DuelStats />
      </section>
      <section>
        <h2 className="text-lg font-black text-dark dark:text-white mb-3">
          Activity
        </h2>
        <ActivityStats />
      </section>
      <section>
        <h2 className="text-lg font-black text-dark dark:text-white mb-3">
          Recent duels
        </h2>
        <RecentDuels />
      </section>
    </div>
  );
}
