"use client";
import { useAppSelector } from "@/state/hooks";
import { useServerCountdown } from "./useServerCountdown";

/**
 * Question-first games: the open question's reading time, before its options
 * show. Display only — the server refuses answers until it is over anyway.
 */
export function useReadingTime(): {
  reading: boolean;
  /** Seconds left to read. */
  left: number;
  /** Seconds the reading time lasts, as received (ring maximum). */
  total: number;
} {
  const opensAt = useAppSelector((state) => state.game.opensAt);
  const readMs = useAppSelector((state) => state.game.readMs);
  const left = useServerCountdown(opensAt);
  return {
    reading: opensAt > 0 && left > 0,
    left,
    total: Math.max(1, Math.ceil(readMs / 1000)),
  };
}
