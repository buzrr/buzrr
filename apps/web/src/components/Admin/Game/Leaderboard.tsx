"use client";

import clsx from "clsx";
import Image from "next/image";
import { DEFAULT_AVATAR } from "@/constants";
import { useAppSelector } from "@/state/hooks";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import EndQuizButton from "@/components/Admin/EndQuizButton";
import { useEndRoomMutation } from "@/lib/modules/game-sessions/hooks";
import {
  labelClass,
  mutedText,
  ordinal,
  panelClass,
  subtleCardClass,
} from "@/components/Game/GameUI";
import type { LeaderboardEntry } from "@buzrr/contract";
import { rankBadgeClass } from "./QuesResult";

const PODIUM = {
  1: {
    color: "#f4c542",
    text: "text-[#9a6b00] dark:text-[#f4c542]",
    step: "h-[140px] md:h-[220px]",
    avatar: "size-[76px] md:size-[104px]",
  },
  2: {
    color: "#b9bfcc",
    text: "text-[#5d6370] dark:text-[#b9bfcc]",
    step: "h-[104px] md:h-[160px]",
    avatar: "size-[60px] md:size-20",
  },
  3: {
    color: "#e0a173",
    text: "text-[#9a5524] dark:text-[#e0a173]",
    step: "h-20 md:h-[120px]",
    avatar: "size-[60px] md:size-20",
  },
} as const;

function PodiumSpot({
  entry,
  place,
}: {
  entry: LeaderboardEntry | undefined;
  place: 1 | 2 | 3;
}) {
  const p = PODIUM[place];
  if (!entry) return <div />;
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <span className="rounded-full p-1" style={{ background: p.color }}>
        <Image
          src={entry.profilePic || DEFAULT_AVATAR}
          width={104}
          height={104}
          alt=""
          className={clsx("rounded-full object-cover", p.avatar)}
        />
      </span>
      <span
        className={clsx(
          "mt-1.5 max-w-full truncate font-bold",
          place === 1 ? "text-base md:text-xl" : "text-sm md:text-[17px]",
        )}
      >
        {entry.name}
      </span>
      <span className={clsx("text-xs md:text-sm font-semibold", mutedText)}>
        {entry.score.toLocaleString()} pts
      </span>
      <div
        className={clsx(
          "mt-2.5 w-full rounded-t-[18px] rounded-b-lg border-t-[5px] flex flex-col items-center pt-4",
          subtleCardClass,
          p.step,
        )}
        style={{ borderTopColor: p.color }}
      >
        <b
          className={clsx(
            "text-2xl md:text-[34px] font-extrabold tracking-[-0.02em] leading-none",
            p.text,
          )}
        >
          {ordinal(place)}
        </b>
      </div>
    </div>
  );
}

/** Small games: how long the final podium shows before the editor. */
const LEAVE_AFTER_MS = 6000;

export default function LeaderBoard({
  roomId,
  quizTitle,
  alreadyEnded,
  quizId,
}: {
  roomId: string;
  quizTitle: string;
  alreadyEnded: boolean;
  /** With fewer than three players the host goes straight back here. */
  quizId?: string;
}) {
  const router = useRouter();
  const endRoom = useEndRoomMutation();
  // The roster, not the leaderboard: the final standings may not have
  // arrived yet on the first render (an empty list closed every game).
  const players = useAppSelector((state) => state.game.players.length);
  // A test run or a tiny game: no podium ceremony — save the result and go
  // back to the quiz editor (players keep their thank-you screen).
  const [stay, setStay] = useState(false);
  const leaving = Boolean(quizId) && players < 3 && !stay;
  const left = useRef(false);
  useEffect(() => {
    if (!leaving || left.current) return;
    // A few seconds on the podium first; "Stay here" cancels.
    const t = setTimeout(() => {
      left.current = true;
      const back = () => router.push(`/admin/quiz/${quizId}`);
      if (alreadyEnded) back();
      else endRoom.mutate(roomId, { onSettled: back });
    }, LEAVE_AFTER_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  const leaderboard = useAppSelector((state) => state.game.leaderboard);
  const qCount = useAppSelector((state) => state.game.qCount);
  const rest = leaderboard.slice(3);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-2 gap-3.5 md:gap-5">
        <section
          className={clsx(
            panelClass,
            "flex flex-col gap-5 p-5 md:p-[30px] md:min-h-0",
          )}
        >
          <div>
            <span className={labelClass}>Final results</span>
            <h2 className="mt-2 text-[26px] md:text-[34px] font-extrabold tracking-[-0.02em] leading-[1.1]">
              Thank you for joining!
            </h2>
            <p className={clsx("mt-2 text-[15px]", mutedText)}>
              {quizTitle} · {qCount} question{qCount === 1 ? "" : "s"} ·{" "}
              {leaderboard.length} player{leaderboard.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex-1 grid grid-cols-[1fr_1.15fr_1fr] gap-3 items-end min-h-0">
            <PodiumSpot entry={leaderboard[1]} place={2} />
            <PodiumSpot entry={leaderboard[0]} place={1} />
            <PodiumSpot entry={leaderboard[2]} place={3} />
          </div>
        </section>

        <section
          className={clsx(
            panelClass,
            "flex flex-col md:min-h-0 md:overflow-hidden",
          )}
        >
          <div className="flex items-center justify-between px-5 md:px-[26px] pt-5 md:pt-6 pb-3.5">
            <h3 className="text-xl md:text-[22px] font-bold">Full rankings</h3>
            <span className={clsx("text-[13.5px]", mutedText)}>
              {leaderboard.length} player{leaderboard.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="md:flex-1 md:min-h-0 md:overflow-y-auto px-3 md:px-[18px] pb-4 flex flex-col gap-1.5">
            {rest.map((lead) => (
              <div
                key={lead.playerId}
                className="flex items-center gap-3 md:gap-[13px] rounded-[14px] border border-transparent px-2.5 py-[9px] transition-colors hover:bg-light-bg dark:hover:bg-card-dark hover:border-lprimary/15 dark:hover:border-white/5"
              >
                <span
                  className={clsx(
                    "size-[30px] shrink-0 rounded-[9px] flex items-center justify-center text-sm font-bold",
                    rankBadgeClass(lead.rank),
                  )}
                >
                  {lead.rank}
                </span>
                <Image
                  src={lead.profilePic || DEFAULT_AVATAR}
                  className="size-9 shrink-0 rounded-full object-cover"
                  width={36}
                  height={36}
                  alt=""
                />
                <span className="flex-1 min-w-0 truncate text-[15px] font-semibold">
                  {lead.name}
                </span>
                <span className="min-w-16 text-right text-base font-bold tabular-nums">
                  {lead.score.toLocaleString()}
                </span>
              </div>
            ))}
            {rest.length === 0 && (
              <p className={clsx("text-center text-sm py-10", mutedText)}>
                {leaderboard.length === 0
                  ? "No players finished this quiz."
                  : "Everyone made the podium!"}
              </p>
            )}
          </div>
        </section>
      </div>
      {/* Same place as "Next question": the very bottom of the screen. */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 py-3 bg-light-bg/90 dark:bg-dark-bg/90 backdrop-blur [&>button]:w-full md:[&>button]:w-auto md:[&>button]:min-w-80">
        {leaving && (
          <span className={clsx("text-sm", mutedText)}>
            Small game — back to the quiz in a few seconds.{" "}
            <button
              type="button"
              onClick={() => setStay(true)}
              className="font-semibold text-lprimary dark:text-dprimary hover:underline cursor-pointer"
            >
              Stay here
            </button>
          </span>
        )}
        <EndQuizButton
          roomId={roomId}
          redirectTo="/admin"
          alreadyEnded={alreadyEnded}
          primaryLabel={alreadyEnded ? "Back to quizzes" : "End game"}
          danger={!alreadyEnded}
        />
      </div>
    </div>
  );
}
