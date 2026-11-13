"use client";

import clsx from "clsx";
import Skeleton from "@/components/ui/Skeleton";
import type { RecentDuel } from "@/lib/modules/duel/api";
import {
  DUEL_PAGE_SIZE,
  useDuelHistoryInfiniteQuery,
  useRecentDuelsQuery,
} from "@/lib/modules/duel/hooks";
import { useLoadMoreOnScroll } from "@/hooks/useLoadMoreOnScroll";
import { useWindowListVirtualizer } from "@/hooks/useWindowListVirtualizer";

/** Row height estimate (measured after render) and the gap between rows. */
const DUEL_ROW_ESTIMATE = 76;
const DUEL_ROW_GAP = 12;

function DuelRowSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-card-dark rounded-xl p-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="flex gap-4 items-center">
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

function DuelSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <DuelRowSkeleton key={index} />
      ))}
    </>
  );
}

function DuelRow({ entry }: { entry: RecentDuel }) {
  const eloDelta =
    entry.eloAfter !== null && entry.eloBefore !== null
      ? entry.eloAfter - entry.eloBefore
      : null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-card-dark rounded-xl p-4">
      <div>
        <p className="font-bold text-dark dark:text-white capitalize">
          {entry.result.quizTitle}
        </p>
        <p
          className="text-xs text-off-dark dark:text-off-white mt-1"
          suppressHydrationWarning
        >
          {new Date(entry.result.endedAt).toLocaleString()}
        </p>
      </div>
      <div className="flex gap-4 text-sm text-dark dark:text-white items-center">
        <span
          className={clsx(
            "font-bold",
            entry.rank === 1 && "text-lprimary dark:text-dprimary",
          )}
        >
          #{entry.rank}
        </span>
        <span>{entry.score} pts</span>
        {eloDelta !== null && (
          <span
            className={clsx(
              "font-bold",
              eloDelta >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-light dark:text-red-dark",
            )}
          >
            {eloDelta >= 0 ? "+" : ""}
            {eloDelta} elo
          </span>
        )}
      </div>
    </div>
  );
}

function DuelsBody({
  duels,
  isPending,
  isError,
  skeletonCount,
  virtual = false,
  children,
}: {
  duels: RecentDuel[];
  isPending: boolean;
  isError: boolean;
  skeletonCount: number;
  /** Render only the rows near the viewport (for the long history list). */
  virtual?: boolean;
  children?: React.ReactNode;
}) {
  if (isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <DuelSkeletons count={skeletonCount} />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-dark dark:text-white">
        Could not load your duels. Try again later.
      </p>
    );
  }
  if (duels.length === 0) {
    return (
      <div className="border border-gray border-dashed rounded-lg p-6 text-center text-dark dark:text-white">
        <p className="text-lg font-black">No duels played yet</p>
        <p className="text-sm mt-2">
          Play a duel and your results will show up here.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {virtual ? (
        <VirtualDuelRows duels={duels} />
      ) : (
        duels.map((entry) => <DuelRow key={entry.id} entry={entry} />)
      )}
      {children}
    </div>
  );
}

function VirtualDuelRows({ duels }: { duels: RecentDuel[] }) {
  const { listRef, virtualizer, scrollMargin } = useWindowListVirtualizer({
    count: duels.length,
    estimateSize: DUEL_ROW_ESTIMATE,
    gap: DUEL_ROW_GAP,
  });
  return (
    <div
      ref={listRef}
      className="relative w-full"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((row) => {
        const entry = duels[row.index]!;
        return (
          <div
            key={entry.id}
            data-index={row.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 w-full"
            style={{ top: row.start - scrollMargin }}
          >
            <DuelRow entry={entry} />
          </div>
        );
      })}
    </div>
  );
}

/** The latest duels (one page), for the profile. */
export function RecentDuelsList() {
  const { data, isPending, isError } = useRecentDuelsQuery(DUEL_PAGE_SIZE);
  return (
    <DuelsBody
      duels={data?.items ?? []}
      isPending={isPending}
      isError={isError}
      skeletonCount={3}
    />
  );
}

/** Full duel history; the next page loads as the end scrolls into view. */
export default function DuelHistoryList() {
  const query = useDuelHistoryInfiniteQuery();
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const duels = query.data?.pages.flatMap((page) => page.items) ?? [];
  const sentinelRef = useLoadMoreOnScroll({
    // After a failed page, wait for the retry button instead of looping.
    hasMore: hasNextPage && !query.isFetchNextPageError,
    loading: isFetchingNextPage,
    loadMore: () => void fetchNextPage(),
  });

  return (
    <DuelsBody
      duels={duels}
      isPending={query.isPending}
      isError={query.isError && !query.data}
      skeletonCount={5}
      virtual
    >
      {isFetchingNextPage && <DuelSkeletons count={3} />}
      {query.isFetchNextPageError && (
        <button
          type="button"
          onClick={() => void fetchNextPage()}
          className="text-sm font-bold text-lprimary dark:text-dprimary hover:underline w-fit"
        >
          Couldn&apos;t load more. Retry
        </button>
      )}
      <div ref={sentinelRef} aria-hidden="true" />
    </DuelsBody>
  );
}
