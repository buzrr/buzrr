"use client";
import clsx from "clsx";
import Link from "next/link";
import ConfettiBurst from "@/components/ConfettiBurst";
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
}

const PLACE_COLOR: Record<number, string> = {
  1: "#f4c542",
  2: "#b9bfcc",
  3: "#e0a173",
};

const Leaderboard = (params: Stats) => {
  const onPodium =
    params.position !== null && params.position >= 1 && params.position <= 3;
  const ringColor = onPodium ? PLACE_COLOR[params.position!] : undefined;

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
          <span className={labelClass}>Final results</span>
          <div
            className="mx-auto mt-5 size-28 rounded-full flex items-center justify-center text-4xl font-extrabold tracking-[-0.02em] animate-pop-in [animation-delay:200ms] bg-lprimary/8 dark:bg-white/5 border-[5px]"
            style={{ borderColor: ringColor ?? "transparent" }}
          >
            {params.position ? ordinal(params.position) : "🎉"}
          </div>
          <h1 className="mt-6 text-[28px] md:text-[34px] font-extrabold tracking-[-0.02em] leading-[1.1]">
            Quiz completed!
          </h1>
          <p className={clsx("mt-2 text-[15px]", mutedText)}>
            Great game — here&apos;s how you did.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            <StatTile
              value={params.position ? ordinal(params.position) : "—"}
              label="Your rank"
            />
            <StatTile
              value={params.score.toLocaleString()}
              label="Total points"
            />
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href={`/player/joinRoom/${params.playerId}`}
              className={clsx(primaryButtonClass, "w-full px-5")}
            >
              Join another game
            </Link>
            <Link
              href="/"
              className="w-full flex items-center justify-center rounded-[14px] border-[1.5px] border-lprimary/15 dark:border-white/10 hover:border-dprimary px-5 py-3.5 text-[15px] font-semibold transition-colors"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default Leaderboard;
