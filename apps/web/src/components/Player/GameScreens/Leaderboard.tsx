"use client";
import Link from "next/link";
import ConfettiBurst from "@/components/ConfettiBurst";

interface Stats {
  position: number | null;
  score: number;
}

const medalFor = (position: number | null) =>
  position === 1 ? "🏆" : position === 2 ? "🥈" : position === 3 ? "🥉" : "🎉";

const Leaderboard = (params: Stats) => {
  const onPodium =
    params.position !== null && params.position >= 1 && params.position <= 3;

  return (
    <>
      {onPodium && <ConfettiBurst />}
      <div className="flex flex-col items-center justify-center min-h-[80dvh] px-4">
        <div className="w-full max-w-md bg-white dark:bg-dark rounded-2xl shadow-lg border border-card-light dark:border-off-dark px-6 sm:px-10 py-10 text-center animate-fade-up">
          <p className="text-6xl mb-4 animate-pop-in [animation-delay:200ms]">
            {medalFor(params.position)}
          </p>
          <h1 className="text-3xl font-black text-dark dark:text-white">
            Quiz completed!
          </h1>
          <p className="mt-2 text-stone-500 dark:text-stone-400">
            Great game — here&apos;s how you did.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-light-bg dark:bg-off-dark p-4">
              <p className="text-xs tracking-[3px] text-stone-500 dark:text-stone-400 mb-1">
                POSITION
              </p>
              <p className="text-3xl font-black text-lprimary dark:text-dprimary">
                {params.position ? `#${params.position}` : "—"}
              </p>
            </div>
            <div className="rounded-xl bg-light-bg dark:bg-off-dark p-4">
              <p className="text-xs tracking-[3px] text-stone-500 dark:text-stone-400 mb-1">
                SCORE
              </p>
              <p className="text-3xl font-black text-lprimary dark:text-dprimary">
                {params.score}
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              href="/player"
              className="w-full inline-flex items-center justify-center rounded-xl font-bold px-5 py-3 transition-all duration-300 ease-in-out bg-lprimary dark:bg-dprimary text-white dark:text-dark"
            >
              Join Another Game
            </Link>
            <Link
              href="/"
              className="w-full inline-flex items-center justify-center rounded-xl font-bold px-5 py-3 transition-all duration-300 ease-in-out border-2 border-lprimary dark:border-dprimary text-lprimary dark:text-dprimary"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default Leaderboard;
