"use client";

import clsx from "clsx";
import Image from "next/image";
import { useState } from "react";
import { LuBan, LuPlay, LuX } from "react-icons/lu";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { DEFAULT_AVATAR } from "@/constants";
import { useAppDispatch, useAppSelector } from "@/state/hooks";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import { playerRemoved } from "@/state/game/gameSlice";
import {
  useBanRoomPlayerMutation,
  useRemoveRoomPlayerMutation,
} from "@/lib/modules/game-sessions/hooks";
import { RevealBreakdown, revealStats } from "@/components/QuestionTypes";
import {
  StatTile,
  labelClass,
  mutedText,
  panelClass,
  primaryButtonClass,
} from "@/components/Game/GameUI";
import type { GameSocket } from "@/types/socket";

interface QuesResultProps {
  socket: GameSocket;
  roomId: string;
}

export const rankBadgeClass = (rank: number) =>
  rank === 1
    ? "bg-[#f4c542] text-[#3a2a00]"
    : rank === 2
      ? "bg-[#cfd3dc] text-[#2a2d33]"
      : rank === 3
        ? "bg-[#e0a173] text-[#3a1d06]"
        : "bg-lprimary/8 dark:bg-white/5 text-off-dark dark:text-[#a1a1aa]";

/**
 * Per-question results. All data (answer counts, running leaderboard,
 * whether this was the last question) is pushed by the server; "Next" is a
 * single pacing intent — the server decides what follows.
 *
 * The leaderboard doubles as the host's moderation surface: every row can be
 * kicked (removed from this round, free to rejoin with the room code) or
 * banned (removed and blocked from rejoining this room).
 */
export default function QuesResult(props: QuesResultProps) {
  const { socket, roomId } = props;
  const dispatch = useAppDispatch();
  const question = useAppSelector((state) => state.game.question);
  const reveal = useAppSelector((state) => state.game.reveal);
  const leaderboard = useAppSelector((state) => state.game.leaderboard);
  const players = useAppSelector((state) => state.game.players);
  const qIndex = useAppSelector((state) => state.game.qIndex);
  const qCount = useAppSelector((state) => state.game.qCount);
  const [advancing, setAdvancing] = useState(false);
  const [playerToBan, setPlayerToBan] = useState<{
    playerId: string;
    name: string;
  } | null>(null);

  const removePlayerMutation = useRemoveRoomPlayerMutation();
  const banPlayerMutation = useBanRoomPlayerMutation();

  const { responses, correct: correctResponses } =
    question && reveal
      ? revealStats(question, reveal.summary)
      : { responses: 0, correct: 0 };
  const correctPct =
    responses > 0 ? Math.round((correctResponses / responses) * 100) : 0;
  const avgTime =
    reveal?.avgTimeMs != null
      ? `${(reveal.avgTimeMs / 1000).toFixed(1)}s`
      : "—";
  const isLastQuestion = qIndex === qCount - 1;
  const connectedById = new Map(players.map((p) => [p.id, p.connected]));

  // Kick and ban go over HTTP so they work even while the host socket is down;
  // the server broadcasts player-removed and a fresh leaderboard to the room.
  function handleKick(playerId: string, name: string) {
    removePlayerMutation.mutate(
      { roomId, playerId },
      {
        onSuccess: () => {
          dispatch(playerRemoved({ playerId }));
          toast.success(`You have removed ${name}`);
        },
        onError: () =>
          toast.error("Could not remove player. Please try again."),
      },
    );
  }

  function handleBan() {
    if (!playerToBan) return;
    const { playerId, name } = playerToBan;
    banPlayerMutation.mutate(
      { roomId, playerId },
      {
        onSuccess: () => {
          dispatch(playerRemoved({ playerId }));
          setPlayerToBan(null);
          toast.success(`You have banned ${name}`);
        },
        onError: () => toast.error("Could not ban player. Please try again."),
      },
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-2 gap-3.5 md:gap-5 md:pb-[18px]">
      <section
        className={clsx(
          panelClass,
          "flex flex-col gap-5 md:gap-[22px] p-5 md:px-[30px] md:py-7 md:min-h-0 md:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        <div>
          <span className={labelClass}>Question {qIndex + 1} results</span>
          <h2 className="mt-2 text-lg md:text-[22px] font-bold leading-[1.3] tracking-[-0.01em] text-pretty wrap-break-word">
            {question?.title}
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          <StatTile
            value={responses}
            suffix={` /${players.length}`}
            label="Responses"
          />
          <StatTile value={`${correctPct}%`} label="Got it right" />
          <StatTile value={avgTime} label="Avg. answer time" />
        </div>
        {question && reveal && (
          <RevealBreakdown question={question} summary={reveal.summary} />
        )}
      </section>

      <section
        className={clsx(
          panelClass,
          "flex flex-col md:min-h-0 md:overflow-hidden",
        )}
      >
        <div className="flex items-center justify-between px-5 md:px-[26px] pt-5 md:pt-6 pb-3.5">
          <h3 className="text-xl md:text-[22px] font-bold">Leaderboard</h3>
          <span className={clsx("text-[13.5px]", mutedText)}>
            {leaderboard.length} player{leaderboard.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="md:flex-1 md:min-h-0 md:overflow-y-auto px-3 md:px-[18px] pb-2.5 flex flex-col gap-1.5">
          {leaderboard.map((lead) => {
            const connected = connectedById.get(lead.playerId);
            return (
              <div
                key={lead.playerId}
                className="group flex items-center gap-3 md:gap-[13px] rounded-[14px] border border-transparent px-2.5 py-[9px] transition-colors hover:bg-light-bg dark:hover:bg-card-dark hover:border-lprimary/15 dark:hover:border-white/5"
              >
                <span
                  className={clsx(
                    "size-[30px] shrink-0 rounded-[9px] flex items-center justify-center text-sm font-bold",
                    rankBadgeClass(lead.rank),
                  )}
                >
                  {lead.rank}
                </span>
                <span className="relative shrink-0">
                  <Image
                    src={lead.profilePic || DEFAULT_AVATAR}
                    className="size-9 rounded-full object-cover"
                    width={36}
                    height={36}
                    alt=""
                  />
                  <span
                    title={connected ? "Connected" : "Disconnected"}
                    className={clsx(
                      "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white dark:border-dark",
                      connected ? "bg-green-500" : "bg-gray",
                    )}
                  />
                </span>
                <span className="flex-1 min-w-0 truncate text-[15px] font-semibold">
                  {lead.name}
                </span>
                {lead.delta !== undefined && (
                  <span
                    className={clsx(
                      "min-w-11 text-right text-[12.5px]",
                      lead.delta > 0
                        ? "font-bold text-green-600 dark:text-green-500"
                        : "font-medium text-[#8a8896] dark:text-[#71717a]",
                    )}
                  >
                    +{lead.delta}
                  </span>
                )}
                <span className="min-w-[52px] text-right text-base font-bold tabular-nums">
                  {lead.score}
                </span>
                <span className="flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    aria-label={`Remove ${lead.name} from this game`}
                    title="Kick — can rejoin with the room code"
                    disabled={removePlayerMutation.isPending}
                    onClick={() => handleKick(lead.playerId, lead.name)}
                    className="size-[30px] rounded-[9px] flex items-center justify-center text-off-dark dark:text-[#a1a1aa] hover:bg-[#e5544e]/14 hover:text-[#e5544e] transition-colors cursor-pointer"
                  >
                    <LuX size={17} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Ban ${lead.name} from this room`}
                    title="Ban — blocked from rejoining this room"
                    onClick={() =>
                      setPlayerToBan({
                        playerId: lead.playerId,
                        name: lead.name,
                      })
                    }
                    className="size-[30px] rounded-[9px] flex items-center justify-center text-off-dark dark:text-[#a1a1aa] hover:bg-[#e5544e]/14 hover:text-[#e5544e] transition-colors cursor-pointer"
                  >
                    <LuBan size={17} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
        <div className="sticky bottom-12 md:static px-4 md:px-[22px] py-4 border-t border-lprimary/15 dark:border-white/10 bg-white dark:bg-dark rounded-b-3xl">
          <button
            type="button"
            disabled={advancing}
            onClick={() => {
              setAdvancing(true);
              socket.emit("host-next");
            }}
            className={clsx(primaryButtonClass, "w-full")}
          >
            {isLastQuestion
              ? "Final leaderboard"
              : `Next question · ${qIndex + 2} of ${qCount}`}
            <LuPlay size={17} className="fill-current" />
          </button>
        </div>
      </section>

      <ConfirmationModal
        open={playerToBan !== null}
        setOpen={(open) => {
          if (!open) setPlayerToBan(null);
        }}
        onClick={handleBan}
        desc={`${playerToBan?.name ?? "This player"} will be removed and blocked from rejoining this room. The ban lasts until this room ends.`}
        confirmLabel="Ban Player"
        confirming={banPlayerMutation.isPending}
        confirmingLabel="Banning…"
      />
    </div>
  );
}
