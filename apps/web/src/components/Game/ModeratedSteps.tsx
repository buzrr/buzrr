"use client";

import clsx from "clsx";
import Image from "next/image";
import { useState } from "react";
import { LuPlay } from "react-icons/lu";
import { DEFAULT_AVATAR } from "@/constants";
import type { LeaderboardEntry } from "@buzrr/contract";
import { useAppSelector } from "@/state/hooks";
import {
  WaitingDots,
  labelClass,
  mutedText,
  panelClass,
  primaryButtonClass,
} from "@/components/Game/GameUI";
import { rankBadgeClass } from "@/components/Admin/Game/QuesResult";

/**
 * Screens for the steps of a moderated game that have no screen of their own
 * (see moderationSettingsSchema): the get-ready slide before a question, the
 * "time's up" pause before the answer, and the players' standings. The host
 * variant carries the button that advances the room (`onNext`).
 */

function Slide({
  badge,
  title,
  subtitle,
  onNext,
  nextLabel,
  waitingFor,
}: {
  badge: string;
  title: string;
  subtitle?: string;
  onNext?: () => void;
  nextLabel?: string;
  waitingFor: string;
}) {
  const [advancing, setAdvancing] = useState(false);
  return (
    <div
      className={clsx(
        "w-full flex flex-col pt-6 md:pt-10 text-dark dark:text-white",
        // Host: fills the game screen, the bar spans its full width (the
        // next step always bottom right).
        onNext
          ? "flex-1 min-h-0"
          : "max-w-3xl mx-auto px-4 min-h-[calc(100dvh-12rem)]",
      )}
    >
      <section
        aria-live="polite"
        className={clsx(
          panelClass,
          // Centered in the space above the host's bottom bar.
          "w-full max-w-3xl mx-auto my-auto relative overflow-hidden flex flex-col items-center text-center gap-5 md:gap-6 px-6 py-9 md:px-12 md:py-12",
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,color-mix(in_srgb,var(--color-dprimary)_16%,transparent),transparent_60%)]"
        />
        <span className="relative text-[12.5px] font-bold tracking-[0.08em] uppercase rounded-full px-3 py-1.5 text-lprimary dark:text-dprimary bg-lprimary/8 dark:bg-white/5">
          {badge}
        </span>
        <h1 className="relative max-w-full text-3xl md:text-5xl font-black tracking-[-0.02em] leading-tight text-pretty wrap-break-word">
          {title}
        </h1>
        {subtitle && (
          <p
            className={clsx(
              "relative text-base md:text-lg font-medium",
              mutedText,
            )}
          >
            {subtitle}
          </p>
        )}
        {!onNext && (
          <div className="relative min-h-6 flex items-center justify-center">
            <WaitingDots>{waitingFor}</WaitingDots>
          </div>
        )}
      </section>
      {onNext && (
        // The host's next step sits at the bottom, like on the results screen.
        <div className="sticky bottom-0 z-10 flex justify-end py-3 bg-light-bg/90 dark:bg-dark-bg/90 backdrop-blur">
          <button
            type="button"
            data-host-key="next"
            title={'You can also press "Space"'}
            disabled={advancing}
            onClick={() => {
              setAdvancing(true);
              onNext();
            }}
            className={clsx(primaryButtonClass, "w-full md:w-auto md:min-w-80")}
          >
            {nextLabel}
            <LuPlay size={17} className="fill-current" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Before every question: the host starts it, then the countdown runs. */
export function ReadySlide({ onNext }: { onNext?: () => void }) {
  const qIndex = useAppSelector((state) => state.game.qIndex);
  const qCount = useAppSelector((state) => state.game.qCount);
  return (
    <Slide
      badge={`Question ${qIndex + 1} of ${qCount}`}
      title="Be prepared!"
      subtitle={
        qIndex === 0
          ? "The quiz is about to begin"
          : "The next question is coming up"
      }
      onNext={onNext}
      nextLabel="Start question"
      waitingFor="Waiting for the host to start"
    />
  );
}

/** The answer window is over; the host shows the answer (or scores) next. */
export function ClosedSlide({
  onNext,
  nextLabel,
}: {
  onNext?: () => void;
  nextLabel?: string;
}) {
  const question = useAppSelector((state) => state.game.question);
  const answeredCount = useAppSelector((state) => state.game.answeredCount);
  const players = useAppSelector((state) => state.game.players);
  // Players online, like the question screen's meter (offline ones may come back).
  const total = Math.max(
    players.filter((p) => p.connected).length,
    answeredCount,
  );
  return (
    <Slide
      badge="Time's up"
      title={question?.title ?? "Time's up!"}
      subtitle={onNext ? `${answeredCount} of ${total} answered` : undefined}
      onNext={onNext}
      nextLabel={nextLabel}
      waitingFor="Waiting for the host"
    />
  );
}

/** Players' standings after a question (moderated "show scores"). */
export function PlayerScores({ playerId }: { playerId: string }) {
  const board = useAppSelector((state) => state.game.leaderboard);
  const qIndex = useAppSelector((state) => state.game.qIndex);
  const you = useAppSelector((state) => state.game.you);
  const me = useAppSelector((state) =>
    state.game.players.find((p) => p.id === playerId),
  );
  // Players are sent the top of the board; below it, their own standing
  // from answer-result (sent once per question) — shown after a gap.
  const leaderboard: LeaderboardEntry[] =
    board.some((e) => e.playerId === playerId) || !you?.rank
      ? board
      : [
          ...board,
          {
            playerId,
            name: me?.name ?? "You",
            profilePic: me?.profilePic ?? null,
            score: you.totalScore,
            rank: you.rank,
            delta: you.score,
          },
        ];
  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6 md:py-10 text-dark dark:text-white">
      <section className={clsx(panelClass, "flex flex-col gap-3 p-5 md:p-7")}>
        <span className={labelClass}>
          Standings after question {qIndex + 1}
        </span>
        <div className="flex flex-col gap-1.5">
          {leaderboard.map((e, i) => (
            <div
              key={e.playerId}
              style={
                i > 0 && e.rank > leaderboard[i - 1]!.rank + 1
                  ? { marginTop: "0.75rem" }
                  : undefined
              }
              className={clsx(
                "flex items-center gap-3 rounded-[14px] px-3 py-2.5",
                e.playerId === playerId
                  ? "bg-lprimary/12 dark:bg-dprimary/15 ring-2 ring-lprimary dark:ring-dprimary"
                  : "bg-light-bg dark:bg-card-dark",
              )}
            >
              <span
                className={clsx(
                  "shrink-0 size-8 rounded-full flex items-center justify-center text-sm font-bold",
                  rankBadgeClass(e.rank),
                )}
              >
                {e.rank}
              </span>
              <Image
                src={e.profilePic || DEFAULT_AVATAR}
                alt=""
                width={32}
                height={32}
                className="rounded-full shrink-0"
              />
              <span className="flex-1 min-w-0 truncate font-semibold">
                {e.name}
              </span>
              {e.delta ? (
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  +{e.delta}
                </span>
              ) : null}
              <span className="min-w-[52px] text-right font-bold tabular-nums">
                {e.score}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
