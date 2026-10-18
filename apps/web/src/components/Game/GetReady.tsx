"use client";

import clsx from "clsx";
import { useAppSelector } from "@/state/hooks";
import { useEffect, useState } from "react";
import { LuSkipForward } from "react-icons/lu";
import { useT } from "@/lib/i18n/context";
import {
  WaitingDots,
  dangerButtonClass,
  mutedText,
  panelClass,
  primaryButtonClass,
} from "@/components/Game/GameUI";

/**
 * Shown between "start game" and the first question (host and players), and
 * as the fallback while a question is on its way. Counts down when the slice
 * has a start deadline; otherwise just says what it's waiting for.
 */
export default function GetReady({
  title,
  onSkip,
  onDownloads,
}: {
  title?: string;
  /** Host with nobody playing: skip the countdown. */
  onSkip?: () => void;
  /** Host, while devices still download the sound: wait for all (true) or go on. */
  onDownloads?: (wait: boolean) => void;
}) {
  const t = useT();
  const phase = useAppSelector((state) => state.game.phase);
  const deadline = useAppSelector((state) => state.game.deadline);
  const countdownMs = useAppSelector((state) => state.game.countdownMs);
  const qIndex = useAppSelector((state) => state.game.qIndex);
  const waitingFor = useAppSelector((state) => state.game.waitingFor);
  const devices = useAppSelector((state) => state.game.downloadDevices);
  const done = useAppSelector((state) => state.game.downloadsDone);
  const waitAll = useAppSelector((state) => state.game.waitAll);
  // Every frame, so the digits and the ring hit 0 exactly at the deadline
  // (with the countdown's beep).
  const remaining = useFrameCountdown(phase === "starting" ? deadline : 0);
  const seconds = Math.ceil(remaining);
  const counting =
    phase === "starting" && deadline > 0 && remaining > 0 && waitingFor === 0;
  // Whether this question's countdown really ran (one with time on it):
  // without one ("∞" questions, a host skipping it) there is no 0 to show.
  const [counted, setCounted] = useState<number | null>(null);
  if (phase === "starting" && countdownMs > 0 && counted !== qIndex) {
    setCounted(qIndex);
  }
  // 0 is the end: red, still — also while devices finish their downloads.
  const zero =
    counted === qIndex &&
    phase === "starting" &&
    deadline > 0 &&
    (remaining <= 0 || waitingFor > 0);
  // No countdown at all: an empty, still round.
  const empty =
    phase === "starting" && !counting && !zero && counted !== qIndex;

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
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,color-mix(in_srgb,var(--color-dprimary)_16%,transparent),transparent_60%)]"
        />

        <span className="relative text-[12.5px] font-bold tracking-[0.08em] uppercase rounded-full px-3 py-1.5 text-lprimary dark:text-dprimary bg-lprimary/8 dark:bg-white/5">
          {t("Be prepared")}
        </span>
        {title && (
          <h1 className="relative max-w-full text-2xl md:text-4xl font-bold tracking-[-0.02em] leading-tight text-pretty wrap-break-word">
            {title}
          </h1>
        )}

        <Countdown
          counting={counting}
          zero={zero}
          empty={empty}
          seconds={seconds}
          remaining={remaining}
          total={countdownMs / 1000}
        />

        <div className="relative min-h-6 flex items-center justify-center">
          {counting || ((zero || empty) && waitingFor === 0) ? (
            <p className={clsx("text-base md:text-lg font-medium", mutedText)}>
              {qIndex > 0
                ? t("Question {n} coming up", { n: qIndex + 1 })
                : t("First question coming up")}
            </p>
          ) : waitingFor > 0 && onDownloads ? (
            <WaitingDots>
              {t("Audio downloads: {done} of {n} done", {
                done,
                n: devices,
              })}
            </WaitingDots>
          ) : waitingFor > 0 ? (
            <WaitingDots>
              {t("Waiting for sound downloads · {n} left", { n: waitingFor })}
            </WaitingDots>
          ) : (
            <WaitingDots>{t("Waiting for the question")}</WaitingDots>
          )}
        </div>
        {onDownloads && phase === "starting" && waitingFor > 0 && (
          <div className="relative flex flex-col items-center gap-3">
            <p className={clsx("text-sm", mutedText)}>
              {waitAll
                ? t("Waiting until every download is done.")
                : t("Wait for them?")}
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={() => onDownloads(false)}
                className={dangerButtonClass}
              >
                {t("No, go on")}
              </button>
              {!waitAll && (
                <button
                  type="button"
                  onClick={() => onDownloads(true)}
                  className={primaryButtonClass}
                >
                  {t("Yes, wait until done")}
                </button>
              )}
            </div>
          </div>
        )}
      </section>
      {onSkip && phase === "starting" && (
        // Skip sits bottom left, like on the question screen.
        <div className="fixed bottom-4 left-4 md:left-8 z-20">
          <button type="button" onClick={onSkip} className={dangerButtonClass}>
            <LuSkipForward size={17} />
            {t("Skip")}
          </button>
        </div>
      )}
    </div>
  );
}

/** Seconds to `deadline` (local clock), updated every animation frame until 0. */
function useFrameCountdown(deadline: number): number {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, (deadline - Date.now()) / 1000);
      setRemaining(left);
      if (left > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deadline]);
  return deadline ? remaining : 0;
}

function Countdown({
  counting,
  zero,
  empty,
  seconds,
  remaining,
  total,
}: {
  counting: boolean;
  /** Reached 0: the whole round turns red, a black 0, nothing moves. */
  zero: boolean;
  /** No countdown here: just the empty ring. */
  empty: boolean;
  seconds: number;
  remaining: number;
  total: number;
}) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const frac =
    counting && total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const label = zero ? 0 : !counting || seconds <= 0 ? null : seconds;
  // No countdown known yet (waiting for the question): a spinner.
  const spinning = !counting && !zero && !empty;
  return (
    <div className="relative size-[150px] md:size-[190px]">
      <svg viewBox="0 0 100 100" className="block size-full -rotate-90">
        <defs>
          <linearGradient id="get-ready-ring" x1="0" x2="1">
            <stop offset="0" style={{ stopColor: "var(--color-dprimary)" }} />
            <stop offset="1" style={{ stopColor: "var(--color-accent)" }} />
          </linearGradient>
        </defs>
        {zero ? (
          // 0: the whole round red — the end, nothing turns any more.
          <circle
            cx="50"
            cy="50"
            r={r + 3}
            className="fill-red-light dark:fill-red-dark"
          />
        ) : (
          <>
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
              // Driven every frame (no CSS transition): it ends exactly on 0.
              strokeDashoffset={
                spinning ? c * 0.72 : empty ? c : c * (1 - frac)
              }
              className={clsx(
                spinning &&
                  "animate-spin origin-center [transform-box:fill-box] [animation-duration:2.4s]",
              )}
            />
          </>
        )}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {label !== null && (
          <b
            key={label}
            className={clsx(
              "font-extrabold leading-none tracking-[-0.03em] tabular-nums animate-pop-in",
              "text-6xl md:text-7xl",
              zero && "text-black",
            )}
          >
            {label}
          </b>
        )}
      </div>
    </div>
  );
}
