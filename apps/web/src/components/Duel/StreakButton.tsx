"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import type { DailyStreak } from "@buzrr/contract";
import { useStreakMonthQuery } from "@/lib/modules/duel/hooks";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  FlameIcon,
} from "./duelUi";

/** How far back the calendar can page. */
const MAX_MONTHS_BACK = 12;
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** "2026-10" shifted by `delta` months. */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Flame + day count for the top bar; opens the daily-streak calendar. One
 * finished duel a day (in the player's time zone) keeps the streak.
 */
export default function StreakButton({ streak }: { streak: DailyStreak }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Daily duel streak"
        className={clsx(
          "flex h-9 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-3 text-base font-extrabold sm:h-10 sm:px-3.5 sm:text-[17px] transition-colors",
          open
            ? "border-flame bg-flame text-white"
            : "border-flame/35 bg-flame/10 text-flame",
        )}
      >
        <FlameIcon size={18} />
        {streak.current}
        <span className="sr-only">day streak</span>
      </button>
      {open && (
        <StreakCalendar streak={streak} onClose={() => setOpen(false)} />
      )}
    </div>
  );
}

function StreakCalendar({
  streak,
  onClose,
}: {
  streak: DailyStreak;
  onClose: () => void;
}) {
  const todayMonth = streak.today.slice(0, 7);
  const todayDate = Number(streak.today.slice(8, 10));
  const [month, setMonth] = useState(todayMonth);
  const { data } = useStreakMonthQuery(month);
  const played = new Set(data?.days ?? []);
  const isCurrentMonth = month === todayMonth;
  const oldest = shiftMonth(todayMonth, -MAX_MONTHS_BACK);

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // Monday-first offset of the 1st.
  const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const banner = streak.playedToday
    ? `Today's duel done · come back tomorrow for day ${streak.current + 1}`
    : streak.current > 0
      ? `Play a duel today to keep your ${streak.current}-day streak`
      : "Play a duel today to start a streak";

  return (
    <div
      role="dialog"
      aria-label="Daily duel streak"
      className="absolute right-[-6px] top-[calc(100%+12px)] z-50 flex w-[min(360px,calc(100vw-24px))] flex-col gap-3.5 rounded-[22px] border border-lprimary/15 dark:border-white/10 bg-white dark:bg-dark p-4 sm:right-0 sm:p-5 text-dark dark:text-white shadow-[0_30px_70px_-24px_rgba(20,10,60,0.45)]"
    >
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-[38px] font-extrabold leading-none text-flame">
          <FlameIcon size={32} />
          {streak.current}
        </span>
        <div>
          <b className="block text-[17px]">day streak</b>
          <small className="block text-[13px] text-off-dark dark:text-muted-dark">
            Play one duel a day to keep it going
          </small>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-auto cursor-pointer self-start text-off-dark dark:text-muted-dark"
        >
          <CloseIcon size={18} />
        </button>
      </div>

      <div
        className={clsx(
          "flex items-center gap-2 rounded-xl px-3 py-2 text-[13.5px] font-semibold",
          streak.playedToday
            ? "bg-green-600/10 text-green-700 dark:text-green-400"
            : "bg-flame/10 text-flame",
        )}
      >
        {streak.playedToday ? <CheckIcon size={15} /> : <FlameIcon size={15} />}
        {banner}
      </div>

      <div className="flex items-center justify-between">
        <MonthButton
          label="Previous month"
          disabled={month <= oldest}
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeftIcon size={15} />
        </MonthButton>
        <b className="text-[15px]">{monthLabel(month)}</b>
        <MonthButton
          label="Next month"
          disabled={isCurrentMonth}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRightIcon size={15} />
        </MonthButton>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5">
        {WEEKDAYS.map((d, i) => (
          <span
            key={`h${i}`}
            className="pb-1 text-center text-xs font-bold text-[#8a8896] dark:text-muted-dark"
          >
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const on = played.has(day);
          const column = i % 7;
          const joinsLeft = on && column !== 0 && played.has(day - 1);
          const joinsRight = on && column !== 6 && played.has(day + 1);
          const isToday = isCurrentMonth && day === todayDate;
          const future = isCurrentMonth && day > todayDate;
          return (
            <span
              key={day}
              className={clsx(
                "flex h-[38px] items-center justify-center text-sm font-semibold",
                on
                  ? "rounded-full bg-flame/20 font-extrabold text-flame"
                  : "text-off-dark dark:text-muted-dark",
                joinsLeft && "rounded-l-none",
                joinsRight && "rounded-r-none",
                isToday &&
                  (on
                    ? "bg-flame! text-white!"
                    : "rounded-full ring-2 ring-inset ring-flame/60"),
                future && "opacity-50",
              )}
              aria-label={on ? `Day ${day}: duel played` : `Day ${day}`}
            >
              {on && isToday ? <FlameIcon size={15} /> : day}
            </span>
          );
        })}
      </div>

      <div className="grid grid-cols-3 border-t border-lprimary/15 dark:border-white/10 pt-3 text-center">
        <Footer value={streak.current} label="Current" />
        <Footer value={streak.best} label="Best" />
        <Footer value={played.size} label="Days this month" />
      </div>
    </div>
  );
}

function MonthButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-[9px] border-[1.5px] border-lprimary/15 dark:border-white/10 disabled:cursor-default disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Footer({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <b className="block text-xl font-extrabold">{value}</b>
      <span className="text-xs text-off-dark dark:text-muted-dark">
        {label}
      </span>
    </div>
  );
}
