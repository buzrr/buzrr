"use client";

import clsx from "clsx";
import { useAppSelector } from "@/state/hooks";
import { useServerCountdown } from "@/hooks/useServerCountdown";
import { WaitingDots, mutedText, panelClass } from "@/components/Game/GameUI";

/**
 * Shown between "start game" and the first question (host and players), and
 * as the fallback while a question is on its way. Counts down when the slice
 * has a start deadline; otherwise just says what it's waiting for.
 */
export default function GetReady({ title }: { title?: string }) {
  const phase = useAppSelector((state) => state.game.phase);
  const deadline = useAppSelector((state) => state.game.deadline);
  const countdownMs = useAppSelector((state) => state.game.countdownMs);
  const remaining = useServerCountdown(phase === "starting" ? deadline : 0);
  const seconds = Math.ceil(remaining);
  const counting = phase === "starting" && deadline > 0;

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col justify-center px-4 py-6 md:py-10 min-h-[calc(100dvh-7.5rem)] text-dark dark:text-white">
      <section
        aria-live="polite"
        className={clsx(
          panelClass,
          "relative overflow-hidden flex flex-col items-center text-center gap-5 md:gap-6 px-6 py-9 md:px-12 md:py-12",
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(139,92,246,0.16),transparent_60%)]"
        />

        <span className="relative text-[12.5px] font-bold tracking-[0.08em] uppercase rounded-full px-3 py-1.5 text-lprimary dark:text-dprimary bg-lprimary/8 dark:bg-white/5">
          Get ready
        </span>
        {title && (
          <h1 className="relative max-w-full text-2xl md:text-4xl font-bold tracking-[-0.02em] leading-tight text-pretty wrap-break-word">
            {title}
          </h1>
        )}

        <Countdown
          counting={counting}
          seconds={seconds}
          remaining={remaining}
          total={countdownMs / 1000}
        />

        <div className="relative min-h-6 flex items-center justify-center">
          {counting ? (
            <p className={clsx("text-base md:text-lg font-medium", mutedText)}>
              First question coming up
            </p>
          ) : (
            <WaitingDots>Waiting for the question</WaitingDots>
          )}
        </div>
      </section>
    </div>
  );
}

function Countdown({
  counting,
  seconds,
  remaining,
  total,
}: {
  counting: boolean;
  seconds: number;
  remaining: number;
  total: number;
}) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const frac =
    counting && total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const label = !counting ? null : seconds > 0 ? seconds : "Go!";
  return (
    <div className="relative size-[150px] md:size-[190px]">
      <svg viewBox="0 0 100 100" className="block size-full -rotate-90">
        <defs>
          <linearGradient id="get-ready-ring" x1="0" x2="1">
            <stop offset="0" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="6"
          className="stroke-lprimary/10 dark:stroke-white/10"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          stroke="url(#get-ready-ring)"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className={clsx(
            "transition-[stroke-dashoffset] duration-250 ease-linear",
            !counting &&
              "animate-spin origin-center [transform-box:fill-box] [animation-duration:2.4s]",
          )}
          style={counting ? undefined : { strokeDashoffset: c * 0.72 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {label !== null && (
          <b
            key={label}
            className={clsx(
              "font-extrabold leading-none tracking-[-0.03em] tabular-nums animate-pop-in",
              label === "Go!"
                ? "text-4xl md:text-5xl text-lprimary dark:text-dprimary"
                : "text-6xl md:text-7xl",
            )}
          >
            {label}
          </b>
        )}
      </div>
    </div>
  );
}
