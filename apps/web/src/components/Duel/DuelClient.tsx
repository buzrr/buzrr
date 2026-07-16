"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_AVATAR } from "@/constants";
import { Button } from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import ClientImage from "@/components/ClientImage";
import { useDuelQueue } from "@/hooks/useDuelQueue";
import { useDuelProfileQuery } from "@/lib/modules/duel/hooks";

export default function DuelClient() {
  const router = useRouter();
  const { data: profile, isPending } = useDuelProfileQuery();
  const { status, error, queuedAt, findMatch, cancel } = useDuelQueue({
    onMatched: (payload) => {
      try {
        sessionStorage.setItem(
          `duel:opponent:${payload.gameCode}`,
          JSON.stringify(payload.opponent),
        );
      } catch {
        // Non-fatal: the game screen falls back to the roster.
      }
      router.push(`/duel/game/${payload.gameCode}`);
    },
  });

  return (
    <div className="flex flex-col min-h-dvh">
      <div className="p-4 flex items-center justify-between">
        <Link href="/">
          <ClientImage
            props={{
              src: "/images/logo.svg",
              darksrc: "/images/logo-dark.svg",
              alt: "Buzrr Logo",
              width: 80,
              height: 80,
            }}
          />
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 pb-16">
        <h1 className="text-3xl md:text-5xl font-black text-dark dark:text-white text-center animate-fade-up">
          1v1 Duel
        </h1>
        <p className="text-sm text-off-dark dark:text-off-white text-center max-w-md animate-fade-up [animation-delay:100ms]">
          Get matched with a player near your rating and battle through quick
          questions. Faster correct answers score more.
        </p>

        {isPending ? (
          <Skeleton className="h-28 w-full max-w-sm rounded-2xl bg-white dark:bg-card-dark" />
        ) : profile ? (
          <div className="flex items-center gap-4 bg-white dark:bg-dark rounded-2xl p-5 w-full max-w-sm shadow border border-card-light dark:border-off-dark animate-fade-up [animation-delay:150ms]">
            <Image
              src={profile.image || DEFAULT_AVATAR}
              width={56}
              height={56}
              alt="Profile"
              className="rounded-full h-14 w-14"
            />
            <div className="flex-1">
              <p className="font-bold text-dark dark:text-white">
                {profile.name ?? "Player"}
              </p>
              <p className="text-xs text-off-dark dark:text-off-white">
                {profile.duelsPlayed} duel{profile.duelsPlayed === 1 ? "" : "s"}{" "}
                played
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-lprimary dark:text-dprimary">
                {profile.eloRating}
              </p>
              <p className="text-xs text-off-dark dark:text-off-white">
                rating
              </p>
            </div>
          </div>
        ) : null}

        {status === "queued" || status === "connecting" ? (
          <SearchingCard queuedAt={queuedAt} onCancel={cancel} />
        ) : status === "matched" ? (
          <p className="font-bold text-dark dark:text-white animate-pulse">
            Opponent found — starting…
          </p>
        ) : (
          <div className="flex flex-col items-center gap-3 w-full max-w-sm">
            {status === "timeout" && (
              <p className="text-sm text-dark dark:text-white text-center">
                No opponent found this time. Try again?
              </p>
            )}
            {status === "error" && error && (
              <p className="text-sm text-red-light dark:text-red-dark text-center">
                {error}
              </p>
            )}
            <Button fullWidth size="lg" onClick={() => void findMatch()}>
              Find Match
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SearchingCard({
  queuedAt,
  onCancel,
}: {
  queuedAt: number | null;
  onCancel: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!queuedAt) return;
    const interval = setInterval(
      () => setElapsed(Math.floor((Date.now() - queuedAt) / 1000)),
      500,
    );
    return () => clearInterval(interval);
  }, [queuedAt]);

  return (
    <div className="flex flex-col items-center gap-4 bg-white dark:bg-dark rounded-2xl p-6 w-full max-w-sm shadow border border-card-light dark:border-off-dark animate-fade-up">
      <div className="h-12 w-12 rounded-full border-4 border-lprimary dark:border-dprimary border-t-transparent dark:border-t-transparent animate-spin" />
      <p className="font-bold text-dark dark:text-white">
        Searching for an opponent… {queuedAt ? `${elapsed}s` : ""}
      </p>
      <p className="text-xs text-off-dark dark:text-off-white text-center">
        The rating range widens the longer you wait.
      </p>
      <Button variant="outline" fullWidth onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
