"use client";

import clsx from "clsx";
import { useId, type ReactNode } from "react";
import ConnectionStatusPill from "@/components/ConnectionStatusPill";

export const OPTION_KEYS = ["A", "B", "C", "D", "E", "F"];
export const OPTION_COLORS = [
  "#7c4ddb",
  "#e5544e",
  "#2f9e6a",
  "#e0a020",
  "#3b82f6",
  "#db2777",
];

export const panelClass =
  "rounded-3xl border bg-white dark:bg-dark border-lprimary/15 dark:border-white/5";
export const subtleCardClass =
  "border bg-light-bg dark:bg-card-dark border-lprimary/15 dark:border-white/5";
export const labelClass =
  "text-xs font-semibold tracking-[0.12em] uppercase text-[#8a8896] dark:text-muted-dark";
export const mutedText = "text-off-dark dark:text-muted-dark";
export const inputClass =
  "w-full rounded-[14px] border-[1.5px] bg-light-bg dark:bg-card-dark border-lprimary/15 dark:border-white/10 px-4 py-[15px] text-base text-dark dark:text-white placeholder:text-[#8a8896] dark:placeholder:text-muted-dark outline-none transition-[border-color,box-shadow] focus:border-dprimary focus:shadow-[0_0_0_4px_rgba(139,92,246,0.15)]";

export const fieldLabelClass =
  "flex items-center justify-between text-sm font-semibold";

export const counterClass =
  "text-[12.5px] font-medium text-[#8a8896] dark:text-muted-dark";

export const primaryButtonClass =
  "flex items-center justify-center gap-2.5 whitespace-nowrap rounded-[14px] px-[30px] py-3.5 text-base font-bold text-white bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] dark:from-accent dark:to-accent-deep shadow-[0_10px_24px_-10px_#7c4ddb] transition-[filter,transform] hover:brightness-108 active:translate-y-px cursor-pointer disabled:opacity-50 disabled:cursor-default disabled:hover:brightness-100";

export function OptionKey({
  index,
  className,
}: {
  index: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "shrink-0 flex items-center justify-center rounded-xl font-extrabold text-white",
        className,
      )}
      style={{ background: OPTION_COLORS[index % OPTION_COLORS.length] }}
    >
      {OPTION_KEYS[index % OPTION_KEYS.length]}
    </span>
  );
}

function Progress({
  qIndex,
  qCount,
  final,
}: {
  qIndex: number;
  qCount: number;
  final?: boolean;
}) {
  const current = qIndex + 1;
  const segmented = qCount <= 15;
  return (
    <div
      className={clsx(
        "flex items-center gap-3.5 rounded-[14px] border px-3.5 py-[7px] bg-white dark:bg-dark border-lprimary/15 dark:border-white/5",
        "flex-1 min-w-0 md:flex-none md:justify-start",
      )}
    >
      <span className="text-[13.5px] font-semibold whitespace-nowrap">
        {final ? (
          <>
            Quiz <b className="text-lprimary dark:text-dprimary">complete</b>
          </>
        ) : (
          <>
            Question{" "}
            <b className="text-lprimary dark:text-dprimary">{current}</b> of{" "}
            {qCount}
          </>
        )}
      </span>
      {segmented && (
        <span className="hidden md:flex gap-1" aria-hidden="true">
          {Array.from({ length: qCount }, (_, i) => (
            <i
              key={i}
              className={clsx(
                "h-1.5 rounded",
                final || i + 1 < current
                  ? "w-3 md:w-[18px] bg-dprimary/55"
                  : i + 1 === current
                    ? "w-5 md:w-7 bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] dark:from-accent dark:to-accent-deep"
                    : "w-3 md:w-[18px] bg-lprimary/10 dark:bg-white/10",
              )}
            />
          ))}
        </span>
      )}
      {/* Continuous bar on mobile (and on desktop for long quizzes). */}
      <span
        className={clsx(
          "h-1.5 flex-1 md:flex-none md:w-28 rounded bg-lprimary/10 dark:bg-white/10 overflow-hidden",
          segmented && "md:hidden",
        )}
        aria-hidden="true"
      >
        <i
          className="block h-full rounded bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] dark:from-accent dark:to-accent-deep"
          style={{ width: `${final ? 100 : (current / qCount) * 100}%` }}
        />
      </span>
      <span
        className={clsx(
          "hidden md:inline text-[12.5px] whitespace-nowrap",
          mutedText,
        )}
      >
        {final ? `${qCount} of ${qCount}` : `${qCount - current} left`}
      </span>
    </div>
  );
}

export function GameTopBar({
  title,
  qIndex,
  qCount,
  final,
  right,
  gameCode,
}: {
  title: string;
  qIndex: number;
  qCount: number;
  final?: boolean;
  right?: ReactNode;
  /** Shown as a small chip beside the connection pill, for late joiners. */
  gameCode?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 md:gap-[18px] py-2 md:py-[18px] shrink-0">
      <div className="flex items-center gap-2 shrink-0">
        <ConnectionStatusPill className="!shadow-none !text-[13px] !font-semibold !px-3 !py-1.5 !border-lprimary/15 dark:!border-white/10 !bg-white dark:!bg-white/5" />
        {gameCode && (
          <span
            title="Game code"
            className="rounded-full border border-lprimary/15 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-[13px] font-semibold"
          >
            <span className={clsx("mr-1.5 font-medium", mutedText)}>Code</span>
            <b className="font-extrabold tracking-[0.1em] text-lprimary dark:text-dprimary">
              {gameCode}
            </b>
          </span>
        )}
      </div>
      <h1 className="hidden md:block flex-1 min-w-0 text-2xl font-bold tracking-[-0.01em] truncate">
        {title}
      </h1>
      {qCount > 0 && <Progress qIndex={qIndex} qCount={qCount} final={final} />}
      {right}
    </div>
  );
}

export function TimerRing({
  value,
  max,
  label = "seconds",
  className,
  valueClassName,
}: {
  value: number;
  max: number;
  label?: string;
  className?: string;
  valueClassName?: string;
}) {
  // Unique per ring: a shared id would bind every ring to the first gradient.
  const gradientId = `ring-grad-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const r = 44;
  const c = 2 * Math.PI * r;
  const low = value <= 5;
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className={clsx("relative shrink-0", className)}>
      <svg viewBox="0 0 100 100" className="block size-full -rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="1">
            <stop offset="0" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#7c4ddb" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="7"
          className="stroke-lprimary/10 dark:stroke-white/10"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          stroke={low ? "#e5544e" : `url(#${gradientId})`}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className="transition-[stroke-dashoffset,stroke] duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <b
          className={clsx(
            "font-extrabold leading-none tracking-[-0.03em]",
            low && "text-[#e5544e]",
            valueClassName,
          )}
        >
          {value}
        </b>
        {label && (
          <span className={clsx("text-[13px] font-medium mt-1", mutedText)}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

/** Horizontal countdown bar — compact alternative to `TimerRing`. */
export function TimerBar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) {
  const low = value <= 5;
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div
      role="timer"
      aria-label={`${Math.ceil(value)} seconds left`}
      className={clsx("flex items-center gap-3", className)}
    >
      <span className="flex-1 h-2.5 rounded-full overflow-hidden bg-lprimary/10 dark:bg-white/10">
        <i
          className={clsx(
            "block h-full rounded-full transition-[width,background-color] duration-250 ease-linear",
            low ? "bg-[#e5544e]" : "bg-linear-to-r from-[#a78bfa] to-[#7c4ddb]",
          )}
          style={{ width: `${frac * 100}%` }}
        />
      </span>
      <b
        className={clsx(
          "w-9 text-right text-lg font-extrabold tabular-nums leading-none",
          low && "text-[#e5544e]",
        )}
      >
        {Math.ceil(value)}s
      </b>
    </div>
  );
}

export function StatTile({
  value,
  suffix,
  label,
  className,
}: {
  value: ReactNode;
  suffix?: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl px-3 py-2.5 md:px-4 md:py-3.5",
        subtleCardClass,
        className,
      )}
    >
      <b className="block text-xl md:text-[26px] font-bold tracking-[-0.02em] leading-[1.1]">
        {value}
        {suffix && (
          <small className={clsx("text-[15px] font-semibold", mutedText)}>
            {suffix}
          </small>
        )}
      </b>
      <span className={clsx("text-[12.5px]", mutedText)}>{label}</span>
    </div>
  );
}

export function WaitingDots({ children }: { children: ReactNode }) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2.5 text-[14.5px] font-medium",
        mutedText,
      )}
    >
      {[0, 200, 400].map((delay) => (
        <i
          key={delay}
          className="size-2 rounded-full bg-dprimary animate-pulse"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
      {children}
    </div>
  );
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
