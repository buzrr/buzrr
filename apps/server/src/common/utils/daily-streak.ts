/**
 * Daily duel streak maths. Days are calendar dates (`YYYY-MM-DD`) in the
 * player's own time zone, so "one duel a day" matches the calendar they see.
 * Pure — the engine shell reads and writes the user row.
 */

/** Whether `timeZone` is an IANA zone this runtime understands. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** `at` as a `YYYY-MM-DD` date in `timeZone` (UTC when unset or unknown). */
export function localDay(
  at: Date,
  timeZone: string | null | undefined,
): string {
  const zone = timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC";
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** A `YYYY-MM-DD` day as the UTC-midnight Date Postgres `DATE` columns use. */
export function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** A `DATE` column value back to `YYYY-MM-DD`. */
export function dateToDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function previousDay(day: string): string {
  const d = dayToDate(day);
  d.setUTCDate(d.getUTCDate() - 1);
  return dateToDay(d);
}

export interface StreakState {
  current: number;
  best: number;
  /** Last day a duel counted, `YYYY-MM-DD`. */
  lastDay: string | null;
}

/**
 * The streak after finishing a duel on `today`. A second duel the same day
 * changes nothing (`advanced: false`); a missed day restarts at 1.
 */
export function advanceStreak(
  prev: StreakState,
  today: string,
): StreakState & { advanced: boolean } {
  if (prev.lastDay === today) return { ...prev, advanced: false };
  const current = prev.lastDay === previousDay(today) ? prev.current + 1 : 1;
  return {
    current,
    best: Math.max(prev.best, current),
    lastDay: today,
    advanced: true,
  };
}

/**
 * The streak to show on `today`: the stored count only survives while its
 * last day is today or yesterday (yesterday = still alive, play today).
 */
export function effectiveStreak(
  current: number,
  lastDay: string | null,
  today: string,
): number {
  if (!lastDay) return 0;
  return lastDay === today || lastDay === previousDay(today) ? current : 0;
}
