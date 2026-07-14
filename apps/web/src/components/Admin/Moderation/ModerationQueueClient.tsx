"use client";

import { useEffect, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "react-toastify";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  useApproveQuestionMutation,
  useModerationQueueQuery,
  useUnapproveQuestionMutation,
} from "@/lib/modules/moderation/hooks";
import type { ModerationQueueItem } from "@/lib/modules/moderation/api";
import { Button } from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";

const ROW_HEIGHT = 180;

export default function ModerationQueueClient() {
  const query = useModerationQueueQuery();
  const approve = useApproveQuestionMutation();
  const unapprove = useUnapproveQuestionMutation();
  const parentRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastItem = virtualItems[virtualItems.length - 1];

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    if (
      lastItem &&
      lastItem.index >= items.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      void fetchNextPage();
    }
  }, [lastItem, items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  function handleApprove(id: string) {
    approve.mutate(id, {
      onError: (err) => toast.error(getApiErrorMessage(err)),
    });
  }

  function handleUnapprove(id: string) {
    unapprove.mutate(id, {
      onError: (err) => toast.error(getApiErrorMessage(err)),
    });
  }

  if (query.isPending) {
    return (
      <div className="mt-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[160px] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <p className="mt-4 text-red-light dark:text-red-dark">
        {getApiErrorMessage(query.error)}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="mt-4 text-dark dark:text-white">
        Nothing to review right now.
      </p>
    );
  }

  return (
    <div
      ref={parentRef}
      className="mt-4 h-[75dvh] overflow-y-auto rounded-xl border border-gray"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index];
          if (!item) return null;
          return (
            <div
              key={item.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              className="border-b border-gray p-4"
            >
              <QueueRow
                item={item}
                onApprove={() => handleApprove(item.id)}
                onUnapprove={() => handleUnapprove(item.id)}
                pending={
                  (approve.isPending && approve.variables === item.id) ||
                  (unapprove.isPending && unapprove.variables === item.id)
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QueueRow({
  item,
  onApprove,
  onUnapprove,
  pending,
}: {
  item: ModerationQueueItem;
  onApprove: () => void;
  onUnapprove: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <div>
        <div className="flex items-center gap-2">
          <StatusPill status={item.moderationStatus} />
          {item.reportCount > 0 && (
            <span className="rounded-full bg-red-light/20 dark:bg-red-dark/20 px-2 py-0.5 text-xs font-bold text-red-light dark:text-red-dark">
              {item.reportCount} report{item.reportCount === 1 ? "" : "s"}
            </span>
          )}
          <span className="text-xs text-off-dark dark:text-off-white">
            {item.quiz.title} · {item.quiz.user.name ?? item.quiz.user.email}
          </span>
        </div>
        <p className="mt-1 font-bold text-dark dark:text-white">
          {item.title}
        </p>
        <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {item.options.map((option) => (
            <p
              key={option.id}
              className={
                option.isCorrect
                  ? "font-bold text-[#20A97C]"
                  : "text-dark dark:text-white"
              }
            >
              {option.title}
            </p>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending} onClick={onApprove}>
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={onUnapprove}
        >
          Unapprove
        </Button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-[#F2AB53]/20 text-[#F2AB53]",
    unapproved: "bg-red-light/20 dark:bg-red-dark/20 text-red-light dark:text-red-dark",
    approved: "bg-[#20A97C]/20 text-[#20A97C]",
    draft: "bg-gray/20 text-off-dark dark:text-off-white",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${styles[status] ?? styles.draft}`}
    >
      {status}
    </span>
  );
}
