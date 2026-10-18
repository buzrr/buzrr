"use client";

import { useEffect, useMemo, useState } from "react";
import { denseRanks, type LeaderboardEntry } from "@buzrr/contract";
import {
  RESORT_MS,
  SETTLE_DELAY_MS,
  countUpMs,
  resortStartMs,
} from "@/lib/podium";

/** The host's standings show this many rows. */
export const RANKING_ROWS = 20;
/** After the re-sort the place numbers pop in top to bottom, this far apart. */
export const RANK_STAGGER_MS = 90;

export type RankingRow = LeaderboardEntry & {
  shownScore: number;
  shownRank: number;
  /** How long its points count up (0: they don't). */
  countMs: number;
  /** New in the list: slides up from below (was further down) or fades in. */
  enter?: "slide" | "fade";
  /** Dropped out of the list: fades out. */
  leaving?: boolean;
};

/**
 * The standings as they were before this question: each score minus its
 * `delta`, re-ranked the way the server ranks (ties share a rank). The
 * server only sends the new ones.
 */
export function previousStandings(entries: LeaderboardEntry[]) {
  const sorted = entries
    .map((entry, i) => ({ entry, i, prev: entry.score - (entry.delta ?? 0) }))
    .sort((a, b) => b.prev - a.prev || a.i - b.i);
  const ranks = denseRanks(sorted.map((s) => s.prev));
  return sorted.map(({ entry, prev }, i) => ({
    ...entry,
    shownScore: prev,
    shownRank: ranks[i]!,
  }));
}

type Stage = "old" | "count" | "sorted" | "done";

/**
 * The host's standings after a question: the old top RANKING_ROWS first,
 * then their points count up in place (the more, the longer — at most
 * MAX_COUNT_MS), then the rows glide into the new order. Who drops out of
 * the list fades out; who comes in slides up from below (or fades in when
 * they weren't on the board at all). Without new points (`delta`) — or
 * while `active` is false — the list just shows the current order.
 */
export function useRankingReveal(
  entries: LeaderboardEntry[],
  active = true,
  rowsShown = RANKING_ROWS,
) {
  const animate = active && entries.some((e) => (e.delta ?? 0) > 0);
  const before = useMemo(() => previousStandings(entries), [entries]);
  const oldTop = useMemo(
    () =>
      before
        .slice(0, rowsShown)
        .map((r) => ({ ...r, countMs: countUpMs(r.delta ?? 0) })),
    [before, rowsShown],
  );
  const countMs = animate ? Math.max(0, ...oldTop.map((r) => r.countMs)) : 0;
  const runKey = animate
    ? entries.map((e) => `${e.playerId}:${e.score}`).join("|")
    : "";

  // Each run (a new board) starts on "old"; timers move it on.
  const [run, setRun] = useState<{ key: string; stage: Stage }>({
    key: "",
    stage: "done",
  });
  const stage: Stage =
    run.key === runKey ? run.stage : animate ? "old" : "done";
  useEffect(() => {
    if (!animate) return;
    const at = (ms: number, s: Stage) =>
      setTimeout(() => setRun({ key: runKey, stage: s }), ms);
    const timers = [
      at(SETTLE_DELAY_MS, "count"),
      at(resortStartMs(countMs), "sorted"),
      at(resortStartMs(countMs) + RESORT_MS, "done"),
    ];
    return () => timers.forEach(clearTimeout);
  }, [animate, runKey, countMs]);

  const rows = useMemo((): RankingRow[] => {
    const fresh = entries.slice(0, rowsShown).map((e) => ({
      ...e,
      shownScore: e.score,
      shownRank: e.rank,
      countMs: countUpMs(e.delta ?? 0),
    }));
    if (stage === "old") return oldTop;
    if (stage === "count") {
      // Same order; the points count up to the new score.
      const byId = new Map(entries.map((e) => [e.playerId, e]));
      return oldTop.map((r) => ({
        ...r,
        shownScore: byId.get(r.playerId)?.score ?? r.shownScore,
      }));
    }
    if (!animate) return fresh;
    const wasShown = new Set(oldTop.map((r) => r.playerId));
    const wasOnBoard = new Set(before.map((r) => r.playerId));
    const withEnter = fresh.map((r) =>
      wasShown.has(r.playerId)
        ? r
        : {
            ...r,
            enter: wasOnBoard.has(r.playerId)
              ? ("slide" as const)
              : ("fade" as const),
          },
    );
    if (stage === "done") return withEnter;
    // "sorted": who dropped out stays a moment, fading out at the bottom.
    const nowShown = new Set(fresh.map((r) => r.playerId));
    const byId = new Map(entries.map((e) => [e.playerId, e]));
    const leaving = oldTop
      .filter((r) => !nowShown.has(r.playerId))
      .map((r) => ({
        ...r,
        shownScore: byId.get(r.playerId)?.score ?? r.shownScore,
        shownRank: byId.get(r.playerId)?.rank ?? r.shownRank,
        leaving: true,
      }));
    return [...withEnter, ...leaving];
  }, [stage, entries, oldTop, before, rowsShown, animate]);

  return {
    rows,
    /** The points are counting (or have counted) up. */
    counted: stage !== "old",
    /**
     * The rows stand in their new order: the place numbers may show. (Before
     * the re-sort they'd still be the old ones.)
     */
    ranked: !animate || stage === "sorted" || stage === "done",
    /** Whether this board runs the sequence at all. */
    animating: animate,
    /** The longest count-up — when the re-sort starts. */
    countMs,
  };
}

/** Leaving rows fade out over the re-sort; entering ones slide or fade in. */
export const rowMotionClass = (row: RankingRow) =>
  row.leaving
    ? "animate-row-out pointer-events-none"
    : row.enter === "slide"
      ? "animate-row-slide-in"
      : row.enter === "fade"
        ? "animate-row-fade-in"
        : "";
