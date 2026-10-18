"use client";

import clsx from "clsx";
import Image from "next/image";
import { DEFAULT_AVATAR } from "@/constants";
import { useAppSelector } from "@/state/hooks";
import { useEffect, useState } from "react";
import EndQuizButton from "@/components/Admin/EndQuizButton";
import ConfettiBurst from "@/components/ConfettiBurst";
import {
  labelClass,
  mutedText,
  ordinal,
  panelClass,
  subtleCardClass,
} from "@/components/Game/GameUI";
import { HOST_LEADERBOARD_TOP, type LeaderboardEntry } from "@buzrr/contract";
import { useT, pl } from "@/lib/i18n/context";
import { rankBadgeClass } from "./QuesResult";
import { podiumEmoji } from "@/components/Game/Flyers";

/** The podium's hearts: the first after this long, then one per place. */
const PODIUM_HEART_MS = 1200;
const PODIUM_HEART_GAP_MS = 700;

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

/** Most avatars a shared podium step draws before "+N". */
const MAX_PODIUM_AVATARS = 3;

/** "Ana", "Ana & Ben", or "Ana +2". */
function podiumNames(entries: LeaderboardEntry[]) {
  if (entries.length === 1) return entries[0]!.name;
  if (entries.length === 2) return `${entries[0]!.name} & ${entries[1]!.name}`;
  return `${entries[0]!.name} +${entries.length - 1}`;
}

/** One podium step — everyone tied on that rank stands on it together. */
function PodiumSpot({
  entries,
  place,
}: {
  entries: LeaderboardEntry[];
  place: 1 | 2 | 3;
}) {
  const t = useT();
  const p = PODIUM[place];
  const shown = entries.slice(0, MAX_PODIUM_AVATARS);
  const shared = entries.length > 1;
  // Once the podium stands: a heart rises from each winner, one by one.
  const ids = shown.map((e) => e.playerId).join("|");
  useEffect(() => {
    if (!ids) return;
    const tm = setTimeout(
      () => ids.split("|").forEach((id) => podiumEmoji(id, "❤️")),
      PODIUM_HEART_MS + (place - 1) * PODIUM_HEART_GAP_MS,
    );
    return () => clearTimeout(tm);
  }, [ids, place]);
  if (entries.length === 0) return <div />;
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div className="flex items-center">
        {shown.map((entry, i) => (
          // Their reactions fly from here (ReactionOverlay).
          <span
            key={entry.playerId}
            className={clsx("rounded-full p-1", i > 0 && "-ml-4 md:-ml-6")}
            style={{ background: p.color }}
            data-podium-player={entry.playerId}
          >
            <Image
              src={entry.profilePic || DEFAULT_AVATAR}
              width={104}
              height={104}
              alt=""
              className={clsx(
                "rounded-full object-cover",
                shared ? "size-11 md:size-16" : p.avatar,
              )}
            />
          </span>
        ))}
      </div>
      <span
        title={shared ? entries.map((e) => e.name).join(", ") : undefined}
        className={clsx(
          "mt-1.5 max-w-full truncate font-bold",
          place === 1 ? "text-base md:text-xl" : "text-sm md:text-[17px]",
        )}
      >
        {podiumNames(entries)}
      </span>
      {shared && (
        <span className="sr-only">
          {t("Tied")}: {entries.map((e) => e.name).join(", ")}
        </span>
      )}
      <span className={clsx("text-xs md:text-sm font-semibold", mutedText)}>
        {entries[0]!.score.toLocaleString()} {t("pts")}
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

/** Final podium: a new burst of fireworks this often. */
const FIREWORKS_EVERY_MS = 6000;

export default function LeaderBoard({
  roomId,
  quizTitle,
  alreadyEnded,
  quizId,
}: {
  roomId: string;
  quizTitle: string;
  alreadyEnded: boolean;
  /** Ending the game goes back to this quiz's editor. */
  quizId?: string;
}) {
  const t = useT();
  // The podium stays until the host ends the game: fireworks every few
  // seconds (the final music loops on its own).
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setBurst((b) => b + 1), FIREWORKS_EVERY_MS);
    return () => clearInterval(t);
  }, []);

  const leaderboard = useAppSelector((state) => state.game.leaderboard);
  // A big room: the host is sent the top HOST_LEADERBOARD_TOP and the count.
  const playerCount =
    useAppSelector((state) => state.game.leaderboardTotal) ??
    leaderboard.length;
  const qCount = useAppSelector((state) => state.game.qCount);
  // Ranks are shared by equal scores, so a step can hold several players.
  const onPlace = (place: number) =>
    leaderboard.filter((entry) => entry.rank === place);
  // The full rankings list everyone, the podium's included (a shared step
  // names only some of its players, "Ana +2").
  const rest = leaderboard.slice(0, HOST_LEADERBOARD_TOP);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <ConfettiBurst key={burst} duration={2500} />
      <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-2 gap-3.5 md:gap-5">
        <section
          className={clsx(
            panelClass,
            "flex flex-col gap-5 p-5 md:p-[30px] md:min-h-0",
          )}
        >
          <div>
            <span className={labelClass}>{t("Final results")}</span>
            <h2 className="mt-2 text-[26px] md:text-[34px] font-extrabold tracking-[-0.02em] leading-[1.1]">
              {t("Thank you for joining!")}
            </h2>
            <p className={clsx("mt-2 text-[15px]", mutedText)}>
              {quizTitle} ·{" "}
              {t(pl(qCount, "{n} question", "{n} questions"), { n: qCount })} ·{" "}
              {t(pl(playerCount, "{n} player", "{n} players"), {
                n: playerCount,
              })}
            </p>
          </div>
          <div className="flex-1 grid grid-cols-[1fr_1.15fr_1fr] gap-3 items-end min-h-0">
            <PodiumSpot entries={onPlace(2)} place={2} />
            <PodiumSpot entries={onPlace(1)} place={1} />
            <PodiumSpot entries={onPlace(3)} place={3} />
          </div>
        </section>

        <section
          className={clsx(
            panelClass,
            "flex flex-col md:min-h-0 md:overflow-hidden",
          )}
        >
          <div className="flex items-center justify-between px-5 md:px-[26px] pt-5 md:pt-6 pb-3.5">
            <h3 className="text-xl md:text-[22px] font-bold">
              {t("Full rankings")}
            </h3>
            <span className={clsx("text-[13.5px]", mutedText)}>
              {t(pl(playerCount, "{n} player", "{n} players"), {
                n: playerCount,
              })}
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
                {t("No players finished this quiz.")}
              </p>
            )}
          </div>
        </section>
      </div>
      {/* Same place as "Next question": the very bottom of the screen. */}
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 py-3 bg-light-bg/90 dark:bg-dark-bg/90 backdrop-blur [&>button]:w-full md:[&>button]:w-auto md:[&>button]:min-w-80">
        <EndQuizButton
          roomId={roomId}
          redirectTo={quizId ? `/admin/quiz/${quizId}` : "/admin"}
          alreadyEnded={alreadyEnded}
          primaryLabel={alreadyEnded ? t("Back to the quiz") : t("End game")}
          danger={!alreadyEnded}
        />
      </div>
    </div>
  );
}
