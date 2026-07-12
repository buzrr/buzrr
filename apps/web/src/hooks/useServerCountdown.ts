"use client";
import { useEffect, useState } from "react";

/**
 * Seconds remaining until a server-issued deadline, corrected for clock skew.
 * The countdown is display-only — phase transitions always come from the
 * server, never from this timer reaching zero.
 */
export function useServerCountdown(
  deadline: number,
  clockOffset: number,
): number {
  const [remaining, setRemaining] = useState(() =>
    computeRemaining(deadline, clockOffset),
  );

  useEffect(() => {
    setRemaining(computeRemaining(deadline, clockOffset));
    if (!deadline) return;
    const interval = setInterval(() => {
      const next = computeRemaining(deadline, clockOffset);
      setRemaining(next);
      if (next <= 0) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, [deadline, clockOffset]);

  return remaining;
}

function computeRemaining(deadline: number, clockOffset: number): number {
  if (!deadline) return 0;
  return Math.max(0, (deadline - (Date.now() + clockOffset)) / 1000);
}
