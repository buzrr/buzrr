"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "react-toastify";
import type {
  BulkModerationResult,
  ModerationListStatus,
} from "@buzrr/contract";
import { getApiErrorMessage } from "@/lib/api/errors";
import {
  useBulkDecisionMutation,
  useDecisionMutation,
  useModerationCountsQuery,
  useModerationQueueQuery,
  useSetQuestionCategoriesMutation,
} from "@/lib/modules/moderation/hooks";
import CategoryChips from "@/components/Admin/CategoryChips";
import { categorySwatch } from "@/components/Duel/duelUi";
import type {
  ModerationDecision,
  ModerationQueueItem,
} from "@/lib/modules/moderation/api";
import { Button } from "@/components/ui/Button";
import {
  QuestionTypeTag,
  cardType,
} from "@/components/Admin/Quiz/QuestionCardBody";
import Skeleton from "@/components/ui/Skeleton";
import BulkCategoriesModal from "./BulkCategoriesModal";

const ROW_HEIGHT = 180;

const STATUS_TABS: { status: ModerationListStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "approved", label: "Approved" },
  { status: "unapproved", label: "Unapproved" },
];

const EMPTY_TEXT: Record<ModerationListStatus, string> = {
  pending: "Nothing waiting for review.",
  approved: "No approved questions yet.",
  unapproved: "No unapproved questions.",
};

const DECISIONS: {
  decision: ModerationDecision;
  /** The tab it moves a question to; the action is hidden there. */
  target: ModerationListStatus;
  label: string;
  done: string;
  variant: "primary" | "outline";
}[] = [
  {
    decision: "approve",
    target: "approved",
    label: "Approve",
    done: "Approved",
    variant: "primary",
  },
  {
    decision: "unapprove",
    target: "unapproved",
    label: "Unapprove",
    done: "Unapproved",
    variant: "outline",
  },
  {
    decision: "pending",
    target: "pending",
    label: "Move to pending",
    done: "Moved to pending",
    variant: "outline",
  },
];

/** The moves that make sense on a tab: never to the tab itself. */
function actionsFor(status: ModerationListStatus) {
  return DECISIONS.filter((d) => d.target !== status);
}

function summarize(verb: string, result: BulkModerationResult): string {
  const skipped = result.skipped.length;
  const reason = result.skipped[0]?.reason;
  return (
    `${verb} ${result.updated} question${result.updated === 1 ? "" : "s"}` +
    (skipped ? ` · ${skipped} skipped (${reason})` : "")
  );
}

export default function QuestionListClient({
  status,
}: {
  status: ModerationListStatus;
}) {
  const query = useModerationQueueQuery(status);
  const decide = useDecisionMutation();
  const bulk = useBulkDecisionMutation();
  const parentRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const actions = actionsFor(status);

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  // A decision moves questions to another tab; only ids still listed here
  // count as selected.
  const selectedIds = useMemo(
    () => items.filter((item) => selected.has(item.id)).map((item) => item.id),
    [items, selected],
  );
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

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

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  }

  function handleDecide(decision: ModerationDecision, id: string) {
    decide.mutate(
      { decision, id },
      { onError: (err) => toast.error(getApiErrorMessage(err)) },
    );
  }

  function handleBulk(action: (typeof DECISIONS)[number]) {
    bulk.mutate(
      { decision: action.decision, ids: selectedIds },
      {
        onSuccess: (result) => {
          toast.success(summarize(action.done, result));
          setSelected(new Set());
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );
  }

  let body: React.ReactNode;
  if (query.isPending) {
    body = (
      <div className="mt-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[160px] w-full rounded-xl" />
        ))}
      </div>
    );
  } else if (query.isError) {
    body = (
      <p className="mt-4 text-red-light dark:text-red-dark">
        {getApiErrorMessage(query.error)}
      </p>
    );
  } else if (items.length === 0) {
    body = (
      <p className="mt-4 text-dark dark:text-white">{EMPTY_TEXT[status]}</p>
    );
  } else {
    body = (
      <>
        <div className="mt-4 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-dark dark:text-white">
            <SelectBox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={toggleAll}
              label="Select all loaded questions"
            />
            {selectedIds.length > 0
              ? `${selectedIds.length} selected`
              : `Select all loaded (${items.length})`}
          </label>
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action.decision}
                  size="sm"
                  variant={action.variant}
                  disabled={bulk.isPending}
                  onClick={() => handleBulk(action)}
                >
                  {action.label}
                </Button>
              ))}
              <Button
                size="sm"
                variant="outline"
                disabled={bulk.isPending}
                onClick={() => setCategoriesOpen(true)}
              >
                Categories…
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={bulk.isPending}
                onClick={() => setSelected(new Set())}
              >
                Clear
              </Button>
            </div>
          )}
        </div>
        <div
          ref={parentRef}
          className="mt-2 h-[70dvh] overflow-y-auto rounded-xl border border-gray"
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
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="border-b border-gray p-4"
                >
                  <QueueRow
                    item={item}
                    selected={selected.has(item.id)}
                    onToggle={() => toggle(item.id)}
                    actions={actions}
                    onDecide={(decision) => handleDecide(decision, item.id)}
                    pending={
                      bulk.isPending ||
                      (decide.isPending && decide.variables?.id === item.id)
                    }
                  />
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="mt-4">
      <StatusTabs status={status} />
      {body}
      <BulkCategoriesModal
        ids={selectedIds}
        open={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        onDone={() => {
          setCategoriesOpen(false);
          setSelected(new Set());
        }}
      />
    </div>
  );
}

function StatusTabs({ status }: { status: ModerationListStatus }) {
  const counts = useModerationCountsQuery();
  return (
    <nav
      aria-label="Moderation status"
      className="inline-flex max-w-full overflow-x-auto rounded-xl bg-lprimary/5 dark:bg-white/5 p-1"
    >
      {STATUS_TABS.map((tab) => {
        const active = tab.status === status;
        const count = counts.data?.[tab.status];
        return (
          <Link
            key={tab.status}
            aria-current={active ? "page" : undefined}
            href={`/admin/duel-portal?status=${tab.status}`}
            className={clsx(
              "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              active
                ? "bg-white dark:bg-card-dark shadow-sm text-lprimary dark:text-dprimary"
                : "text-dark/60 dark:text-white/60 hover:text-dark dark:hover:text-white",
            )}
          >
            {tab.label}
            {count !== undefined && (
              <span className="rounded-full bg-lprimary/10 dark:bg-white/10 px-1.5 text-xs tabular-nums">
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SelectBox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 shrink-0 cursor-pointer accent-lprimary dark:accent-dprimary"
    />
  );
}

function QueueRow({
  item,
  selected,
  onToggle,
  actions,
  onDecide,
  pending,
}: {
  item: ModerationQueueItem;
  selected: boolean;
  onToggle: () => void;
  actions: typeof DECISIONS;
  onDecide: (decision: ModerationDecision) => void;
  pending: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="pt-1">
        <SelectBox
          checked={selected}
          onChange={onToggle}
          label={`Select "${item.title}"`}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={item.moderationStatus} />
            <QuestionTypeTag type={cardType(item)} />
            {item.reportCount > 0 && (
              <span className="rounded-full bg-red-light/20 dark:bg-red-dark/20 px-2 py-0.5 text-xs font-bold text-red-light dark:text-red-dark">
                {item.reportCount} report{item.reportCount === 1 ? "" : "s"}
              </span>
            )}
            <span className="min-w-0 break-words text-xs text-off-dark dark:text-off-white">
              {sourceLabel(item)}
            </span>
          </div>
          <p className="mt-1 break-words font-bold text-dark dark:text-white">
            {item.title}
          </p>
          <div className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            {item.options.map((option) => (
              <p
                key={option.id}
                className={`min-w-0 break-words ${
                  option.isCorrect
                    ? "font-bold text-[#20A97C]"
                    : "text-dark dark:text-white"
                }`}
              >
                {option.title}
              </p>
            ))}
          </div>
        </div>
        <QueueRowCategories item={item} />
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.decision}
              size="sm"
              variant={action.variant}
              disabled={pending}
              onClick={() => onDecide(action.decision)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Where a question lives: its quiz and owner, or "Standalone" + author. */
function sourceLabel(item: ModerationQueueItem): string {
  if (item.quiz) {
    return `${item.quiz.title} · ${item.quiz.user.name ?? item.quiz.user.email}`;
  }
  const author = item.createdBy?.name ?? item.createdBy?.email;
  return author ? `Standalone · ${author}` : "Standalone";
}

/**
 * The question's categories, editable in place. Retagging only changes which
 * duel pools serve the question, so it doesn't re-moderate it.
 */
function QueueRowCategories({ item }: { item: ModerationQueueItem }) {
  const [editing, setEditing] = useState(false);
  // The selection being edited: kept locally so a click made while the queue
  // refetches builds on the previous one rather than on stale item data.
  const [selected, setSelected] = useState<string[]>([]);
  const setCategories = useSetQuestionCategoriesMutation();

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <CategoryChips
          value={selected}
          disabled={setCategories.isPending}
          onChange={(categoryIds) => {
            const previous = selected;
            setSelected(categoryIds);
            setCategories.mutate(
              { id: item.id, categoryIds },
              {
                onError: (err) => {
                  setSelected(previous);
                  toast.error(getApiErrorMessage(err));
                },
              },
            );
          }}
        />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="self-start cursor-pointer text-xs font-semibold text-lprimary dark:text-dprimary"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {item.categories.length === 0 ? (
        <span className="text-off-dark dark:text-off-white">No categories</span>
      ) : (
        item.categories.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-card-light dark:bg-card-dark px-2 py-0.5 font-semibold text-dark dark:text-white"
          >
            <span
              className="h-2 w-2 rounded-[3px]"
              style={{ background: categorySwatch(c.hue) }}
            />
            {c.name}
          </span>
        ))
      )}
      <button
        type="button"
        onClick={() => {
          setSelected(item.categories.map((c) => c.id));
          setEditing(true);
        }}
        className="cursor-pointer font-semibold text-lprimary dark:text-dprimary"
      >
        Edit
      </button>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-[#F2AB53]/20 text-[#F2AB53]",
    unapproved:
      "bg-red-light/20 dark:bg-red-dark/20 text-red-light dark:text-red-dark",
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
