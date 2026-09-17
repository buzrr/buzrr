"use client";
import { useEffect, useState } from "react";

/**
 * Seconds remaining until a deadline on the local clock (the slice derives it
 * from the server's `remainingMs`). The countdown is display-only — phase
 * transitions always come from the server, never from this timer reaching
 * zero.
 */
export function useServerCountdown(deadline: number): number {
  const [remaining, setRemaining] = useState(() => computeRemaining(deadline));

  useEffect(() => {
    setRemaining(computeRemaining(deadline));
    if (!deadline) return;
    const interval = setInterval(() => {
      const next = computeRemaining(deadline);
      setRemaining(next);
      if (next <= 0) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, [deadline]);

  return remaining;
}

function computeRemaining(deadline: number): number {
  if (!deadline) return 0;
  return Math.max(0, (deadline - Date.now()) / 1000);
}
