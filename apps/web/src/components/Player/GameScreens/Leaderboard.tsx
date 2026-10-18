"use client";
import clsx from "clsx";
import Link from "next/link";
import ConfettiBurst from "@/components/ConfettiBurst";
import { clearFinalResult } from "@/lib/final-result";
import { useT } from "@/lib/i18n/context";
import {
  StatTile,
  labelClass,
  mutedText,
  ordinal,
  panelClass,
  primaryButtonClass,
} from "@/components/Game/GameUI";

interface Stats {
  playerId: string;
  position: number | null;
  score: number;
  quizTitle?: string;
  /** Players in the final standings. */
  players?: number;
  /**
   * Not yet: the host's board re-sorts and fills the podium first
   * (moderated games) — the place shows after.
   */
  held?: boolean;
}

const PLACE_COLOR: Record<number, string> = {
  1: "#f4c542",
  2: "#b9bfcc",
  3: "#e0a173",
};

const Leaderboard = (params: Stats) => {
  const t = useT();
  const held = params.held ?? false;
  const onPodium =
    params.position !== null && params.position >= 1 && params.position <= 3;
  const ringColor = onPodium ? PLACE_COLOR[params.position!] : undefined;

  if (held) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80dvh] px-4 text-dark dark:text-white">
        <div
          className={clsx(
            panelClass,
            "w-full max-w-md px-6 sm:px-10 py-12 text-center animate-fade-up",
          )}
        >
          <span className={labelClass}>{t("Final results")}</span>
          <p className="mt-5 text-2xl font-extrabold animate-pulse">
            {t("Final results coming up")}
          </p>
          <p className={clsx("mt-3 text-sm", mutedText)}>
            {t("Watch the big screen!")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {onPodium && <ConfettiBurst />}
      <div className="flex flex-col items-center justify-center min-h-[80dvh] px-4 text-dark dark:text-white">
        <div
          className={clsx(
            panelClass,
            "w-full max-w-md px-6 sm:px-10 py-10 text-center animate-fade-up",
          )}
        >
          <span className={labelClass}>
            {params.quizTitle
              ? `${params.quizTitle} · final results`
              : t("Final results")}
          </span>
          <div
            className="mx-auto mt-5 size-28 rounded-full flex items-center justify-center text-4xl font-extrabold tracking-[-0.02em] animate-pop-in [animation-delay:200ms] bg-lprimary/8 dark:bg-white/5 border-[5px]"
            style={{ borderColor: ringColor ?? "transparent" }}
          >
            {params.position ? ordinal(params.position) : "🎉"}
          </div>
          <h1 className="mt-6 text-[28px] md:text-[34px] font-extrabold tracking-[-0.02em] leading-[1.1]">
            {t("Thank you for playing!")}
          </h1>
          <p className={clsx("mt-2 text-[15px]", mutedText)}>
            {params.position
              ? params.players
                ? t("You finished {place} of {n}.", {
                    place: ordinal(params.position),
                    n: params.players,
                  })
                : t("You finished {place}.", {
                    place: ordinal(params.position),
                  })
              : t("Great game — here's how you did.")}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            <StatTile
              value={params.position ? ordinal(params.position) : "—"}
              label={t("Your rank")}
            />
            <StatTile
              value={params.score.toLocaleString()}
              label={t("Total points")}
            />
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href={`/player/joinRoom/${params.playerId}`}
              onClick={clearFinalResult}
              className={clsx(primaryButtonClass, "w-full px-5")}
            >
              {t("Join another game")}
            </Link>
            <Link
              href="/"
              className="w-full flex items-center justify-center rounded-[14px] border-[1.5px] border-lprimary/15 dark:border-white/10 hover:border-dprimary px-5 py-3.5 text-[15px] font-semibold transition-colors"
            >
              {t("Back to home")}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default Leaderboard;
