"use client";

import clsx from "clsx";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  RevealBreakdown,
  revealStats,
  QuestionTypePill,
  isScoredType,
} from "@/components/QuestionTypes";
import {
  StatTile,
  labelClass,
  mutedText,
  panelClass,
  primaryButtonClass,
} from "@/components/Game/GameUI";
import { AnimatedNumber, useFlipReorder } from "@/components/Game/motion";
import {
  HOST_LEADERBOARD_TOP,
  denseRanks,
  type LeaderboardEntry,
} from "@buzrr/contract";
import {
  leaderboardWithReveal,
  nextQuestionLabel,
  scoresStepPending,
} from "@/lib/moderation";
import type { GameSocket } from "@/types/socket";

/** Hold the old standings until the answer bars have mostly filled. */
const SETTLE_DELAY_MS = 1100;

/**
 * The standings as they were before this question: each score minus its
 * `delta`, re-ranked the way the server ranks (ties share a rank). The
 * server only sends the new ones.
 */
function previousStandings(entries: LeaderboardEntry[]) {
  const sorted = entries
    .map((entry, i) => ({ entry, i, prev: entry.score - (entry.delta ?? 0) }))
    .sort((a, b) => b.prev - a.prev || a.i - b.i);
  const ranks = denseRanks(sorted.map((s) => s.prev));
  return sorted.map(({ entry, prev }, i) => ({
    ...entry,
    shownScore: prev,
    shownRank: ranks[i]!,
  }));
}

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
        : "bg-lprimary/8 dark:bg-white/5 text-off-dark dark:text-muted-dark";

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
  const leaderboardTotal = useAppSelector(
    (state) => state.game.leaderboardTotal,
  );
  const players = useAppSelector((state) => state.game.players);
  const qIndex = useAppSelector((state) => state.game.qIndex);
  const qCount = useAppSelector((state) => state.game.qCount);
  const phase = useAppSelector((state) => state.game.phase);
  const moderation = useAppSelector((state) => state.game.moderation);
  // Moderated: the answer and the standings can be separate steps.
  const showAnswerPanel = phase !== "scores" || reveal !== null;
  // An unscored question changes no score: no standings after it.
  const scoredQ = question ? isScoredType(question.type) : true;
  const showBoard =
    scoredQ &&
    (phase === "scores" ||
      leaderboardWithReveal(moderation, qIndex >= qCount - 1));
  // Not after the last question: the final standings come next.
  const nextIsScores =
    phase === "reveal" &&
    scoresStepPending(moderation) &&
    scoredQ &&
    qIndex < qCount - 1;
  // Re-armed on every step: "Show standings" keeps this screen mounted.
  const [advancing, setAdvancing] = useState(false);
  const [armedPhase, setArmedPhase] = useState(phase);
  if (armedPhase !== phase) {
    setArmedPhase(phase);
    setAdvancing(false);
  }
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
  // Many options: a tighter panel, so all of them fit without scrolling.
  const manyOptions =
    question !== null &&
    question !== undefined &&
    "options" in question &&
    question.options.length >= 5;
  const scored = question ? isScoredType(question.type) : true;

  // Start on the pre-question standings (once they are on screen), then
  // count scores up and let rows glide into their new ranks.
  const [settled, setSettled] = useState(false);
  const [settleArmed, setSettleArmed] = useState(showBoard);
  if (settleArmed !== showBoard) {
    setSettleArmed(showBoard);
    setSettled(false);
  }
  useEffect(() => {
    if (!showBoard) return;
    const t = setTimeout(() => setSettled(true), SETTLE_DELAY_MS);
    return () => clearTimeout(t);
  }, [showBoard]);

  // "Show answer": the whole question grows once, briefly, as the right
  // answer turns green.
  const answerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (phase !== "reveal") return;
    answerRef.current?.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.035)", offset: 0.35 },
        { transform: "scale(1)" },
      ],
      { duration: 800, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
  }, [phase]);
  // The server sends the host the top HOST_LEADERBOARD_TOP before and after
  // the question: the old top shows first, then the new one.
  const rows = useMemo(
    () =>
      (settled
        ? leaderboard.map((e) => ({
            ...e,
            shownScore: e.score,
            shownRank: e.rank,
          }))
        : previousStandings(leaderboard)
      ).slice(0, HOST_LEADERBOARD_TOP),
    [leaderboard, settled],
  );
  const playerCount = leaderboardTotal ?? leaderboard.length;

  // An emoji meant for the board (a right answer at the reveal, the scores
  // step's top SCORES_EMOJI_TOP) stays on the player's row — this question's
  // board only: it remounts with the next.
  const [rowEmoji, setRowEmoji] = useState<Record<string, string>>({});
  const onBoard = phase === "reveal" || phase === "scores";
  useEffect(() => {
    if (!socket || !onBoard) return;
    const onReaction = (r: {
      playerId: string;
      emoji: string;
      board?: boolean;
    }) => {
      if (r.board) setRowEmoji((m) => ({ ...m, [r.playerId]: r.emoji }));
    };
    socket.on("reaction", onReaction);
    return () => {
      socket.off("reaction", onReaction);
    };
  }, [socket, onBoard]);
  const listRef = useRef<HTMLDivElement>(null);
  useFlipReorder(listRef, rows.map((r) => r.playerId).join());
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
    <div className="flex-1 min-h-0 flex flex-col">
      <div
        className={clsx(
          "flex-1 min-h-0 flex flex-col md:grid gap-3.5 md:gap-5",
          showAnswerPanel && showBoard ? "md:grid-cols-2" : "md:grid-cols-1",
        )}
      >
        {showAnswerPanel && (
          <section
            ref={answerRef}
            className={clsx(
              panelClass,
              "flex flex-col p-5 md:px-[30px] md:min-h-0 md:overflow-y-auto [scrollbar-width:thin]",
              manyOptions
                ? "gap-3 md:gap-3.5 md:py-5"
                : "gap-5 md:gap-[22px] md:py-7",
            )}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={labelClass}>
                  Question {qIndex + 1} results
                </span>
                {question && !scored && (
                  <QuestionTypePill type={question.type} />
                )}
              </div>
              <h2 className="mt-2 text-lg md:text-[22px] font-bold leading-[1.3] tracking-[-0.01em] text-pretty wrap-break-word">
                {question?.title}
              </h2>
            </div>
            <div
              className={clsx(
                "grid gap-2 md:gap-3",
                scored ? "grid-cols-3" : "grid-cols-2",
              )}
            >
              <StatTile
                value={responses}
                suffix={` /${Math.max(players.filter((p) => p.connected).length, responses)}`}
                label="Responses"
              />
              {scored && (
                <StatTile value={`${correctPct}%`} label="Got it right" />
              )}
              <StatTile value={avgTime} label="Avg. answer time" />
            </div>
            {question && reveal && (
              <RevealBreakdown question={question} summary={reveal.summary} />
            )}
          </section>
        )}

        {showBoard && (
          <section
            className={clsx(
              panelClass,
              "flex flex-col md:min-h-0 md:overflow-hidden",
            )}
          >
            <div className="flex items-center justify-between px-5 md:px-[26px] pt-5 md:pt-6 pb-3.5">
              <h3 className="text-xl md:text-[22px] font-bold">Leaderboard</h3>
              <span className={clsx("text-[13.5px]", mutedText)}>
                {playerCount === 1
                  ? `${playerCount} player`
                  : `${playerCount} players`}
              </span>
            </div>
            <div
              ref={listRef}
              className="md:flex-1 md:min-h-0 md:overflow-y-auto px-3 md:px-[18px] pb-2.5 flex flex-col gap-1.5"
            >
              {rows.map((lead) => {
                const connected = connectedById.get(lead.playerId);
                return (
                  <div
                    key={lead.playerId}
                    data-flip-id={lead.playerId}
                    className="group relative bg-white dark:bg-dark flex items-center gap-3 md:gap-[13px] rounded-[14px] border border-transparent px-2.5 py-[9px] transition-colors hover:bg-light-bg dark:hover:bg-card-dark hover:border-lprimary/15 dark:hover:border-white/5"
                  >
                    <span
                      className={clsx(
                        "size-[30px] shrink-0 rounded-[9px] flex items-center justify-center text-sm font-bold transition-colors duration-500",
                        rankBadgeClass(lead.shownRank),
                      )}
                    >
                      {lead.shownRank}
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
                    {rowEmoji[lead.playerId] && (
                      <span
                        key={rowEmoji[lead.playerId]}
                        aria-hidden
                        className="shrink-0 text-2xl leading-none animate-pop-in"
                      >
                        {rowEmoji[lead.playerId]}
                      </span>
                    )}
                    {lead.delta !== undefined && (
                      <span
                        className={clsx(
                          "min-w-11 text-right text-[12.5px]",
                          lead.delta > 0
                            ? "font-bold text-green-600 dark:text-green-500"
                            : "font-medium text-[#8a8896] dark:text-muted-dark",
                          settled && lead.delta > 0 && "animate-pop",
                        )}
                      >
                        +{lead.delta}
                      </span>
                    )}
                    <span className="min-w-[52px] text-right text-base font-bold tabular-nums">
                      <AnimatedNumber value={lead.shownScore} />
                    </span>
                    <span className="flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        aria-label={`Remove ${lead.name} from this game`}
                        title="Kick — can rejoin with the room code"
                        disabled={removePlayerMutation.isPending}
                        onClick={() => handleKick(lead.playerId, lead.name)}
                        className="size-[30px] rounded-[9px] flex items-center justify-center text-off-dark dark:text-muted-dark hover:bg-[#e5544e]/14 hover:text-[#e5544e] transition-colors cursor-pointer"
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
                        className="size-[30px] rounded-[9px] flex items-center justify-center text-off-dark dark:text-muted-dark hover:bg-[#e5544e]/14 hover:text-[#e5544e] transition-colors cursor-pointer"
                      >
                        <LuBan size={17} />
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
      {/* One place for the host's next step, always at the bottom. */}
      <div className="sticky bottom-0 z-10 flex justify-end py-3 bg-light-bg/90 dark:bg-dark-bg/90 backdrop-blur">
        <button
          type="button"
          data-host-key="next"
          title={'You can also press "Space"'}
          disabled={advancing}
          onClick={() => {
            setAdvancing(true);
            socket.emit("host-next");
          }}
          className={clsx(primaryButtonClass, "w-full md:w-auto md:min-w-80")}
        >
          {nextIsScores
            ? "Show standings"
            : isLastQuestion
              ? "Final leaderboard"
              : nextQuestionLabel(qIndex, qCount)}
          <LuPlay size={17} className="fill-current" />
        </button>
      </div>

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
