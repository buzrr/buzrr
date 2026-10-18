"use client";

import clsx from "clsx";
import Image from "next/image";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import type { LeaderboardEntry } from "@buzrr/contract";
import { useAudioSegment } from "@/lib/audio-cues";
import { RevealDensity } from "@/components/QuestionTypes/MultipleChoice";
import { useGameSound } from "@/lib/sound/director";
import ConfettiBurst from "@/components/ConfettiBurst";
import {
  closedNextLabel,
  leaderboardWithReveal,
  nextQuestionLabel,
  scoresStepPending,
} from "@/lib/moderation";
import { useT, pl, currentLocale } from "@/lib/i18n/context";
import type { GameSocket } from "@/types/socket";

/** Hold the old standings until the answer bars have mostly filled. */
const SETTLE_DELAY_MS = 1100;

/**
 * The standings as they were before this question: each score minus its
 * `delta`, re-ranked (ties share a rank). The server only sends the new ones.
 */
function previousStandings(entries: LeaderboardEntry[]) {
  const sorted = entries
    .map((entry, i) => ({ entry, i, prev: entry.score - (entry.delta ?? 0) }))
    .sort((a, b) => b.prev - a.prev || a.i - b.i);
  return sorted.map(({ entry, prev }) => ({
    ...entry,
    shownScore: prev,
    shownRank: sorted.findIndex((s) => s.prev === prev) + 1,
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
  const t = useT();
  const { socket, roomId } = props;
  const dispatch = useAppDispatch();
  const question = useAppSelector((state) => state.game.question);
  const revealed = useAppSelector((state) => state.game.reveal);
  const closedSummary = useAppSelector((state) => state.game.closedSummary);
  // Moderated "closed": the tally is on screen, the right answer isn't yet.
  const closed = useAppSelector((state) => state.game.phase === "closed");
  const reveal = closed ? closedSummary : revealed;
  const leaderboard = useAppSelector((state) => state.game.leaderboard);
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
    !closed &&
    (phase === "scores" || leaderboardWithReveal(moderation));
  const nextIsScores =
    phase === "reveal" && scoresStepPending(moderation) && scoredQ;
  // The reveal cue plays when the answer is shown, until the host moves on.
  const sound = useGameSound();
  const audioHere = sound ? sound.questionAudioHere(question?.audio) : true;
  const a = question?.audio;
  useAudioSegment(
    phase === "reveal" && audioHere
      ? (a?.revealUrl ?? (a?.encrypted ? null : a?.url))
      : null,
    a?.revealMs,
    null,
    question?.id,
    a?.revealUrl ? reveal?.audioRevealKey : null,
  );
  // Re-armed on every step: "Show answer" keeps this screen mounted.
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
      ? `${(reveal.avgTimeMs / 1000).toLocaleString(currentLocale(), { maximumFractionDigits: 1, minimumFractionDigits: 1 })} s`
      : "—";
  const isLastQuestion = qIndex === qCount - 1;
  // Many options: a tighter panel, so all of them fit without scrolling.
  const manyOptions =
    question !== null &&
    question !== undefined &&
    "options" in question &&
    question.options.length >= 5;
  const scored = question ? isScoredType(question.type) : true;

  // Start on the pre-question standings, then count scores up and let rows
  // glide into their new ranks.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!showBoard) return;
    setSettled(false);
    const t = setTimeout(() => setSettled(true), SETTLE_DELAY_MS);
    return () => clearTimeout(t);
  }, [showBoard]);

  // "Show answer": the whole question grows once, briefly, as the right
  // answer turns green.
  const answerRef = useRef<HTMLElement>(null);
  // Every answer has to fit the panel (tablets, two-line questions): while
  // it overflows, step down to a denser layout — per question, one way.
  const [dense, setDense] = useState<{ id: string; level: number }>();
  const qid = question?.id ?? "";
  const density = dense?.id === qid ? dense.level : 0;
  useLayoutEffect(() => {
    const el = answerRef.current;
    if (!el || !qid || density >= 2) return;
    const check = () => {
      if (window.innerWidth < 768) return; // phones scroll the page
      if (el.scrollHeight > el.clientHeight + 1) {
        setDense({ id: qid, level: density + 1 });
      }
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [qid, density]);
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
  const rows = useMemo(
    () =>
      settled
        ? leaderboard.map((e) => ({
            ...e,
            shownScore: e.score,
            shownRank: e.rank,
          }))
        : previousStandings(leaderboard),
    [leaderboard, settled],
  );
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
          toast.success(t("You have removed {name}", { name }));
        },
        onError: () =>
          toast.error(t("Could not remove player. Please try again.")),
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
          toast.success(t("You have banned {name}", { name }));
        },
        onError: () =>
          toast.error(t("Could not ban player. Please try again.")),
      },
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div
        className={clsx(
          "flex-1 min-h-0 flex flex-col md:grid gap-3.5 md:gap-5",
          // Results two thirds, leaderboard one third.
          showAnswerPanel && showBoard
            ? "md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
            : "md:grid-cols-1",
        )}
      >
        {/* The results animation (with the skin's reveal sound). */}
        {phase === "reveal" && <ConfettiBurst duration={1400} />}
        {showAnswerPanel && (
          <section
            ref={answerRef}
            className={clsx(
              panelClass,
              "flex flex-col p-5 md:px-[30px] md:min-h-0 md:overflow-y-auto [scrollbar-width:thin]",
              manyOptions || density >= 1
                ? "gap-3 md:gap-3.5 md:py-5"
                : "gap-5 md:gap-[22px] md:py-7",
            )}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={labelClass}>
                  {t("Question {n} results", { n: qIndex + 1 })}
                </span>
                {question && !scored && (
                  <QuestionTypePill type={question.type} />
                )}
              </div>
              <h2
                className={clsx(
                  "mt-2 text-lg font-bold leading-[1.3] tracking-[-0.01em] text-pretty wrap-break-word",
                  density >= 1 ? "md:text-[19px]" : "md:text-[22px]",
                )}
              >
                {question?.title}
              </h2>
            </div>
            <div
              className={clsx(
                "grid gap-2 md:gap-3",
                scored && !closed ? "grid-cols-3" : "grid-cols-2",
              )}
            >
              <StatTile
                value={responses}
                suffix={` /${Math.max(players.filter((p) => p.connected).length, responses)}`}
                label={t("Responses")}
              />
              {scored && !closed && (
                <StatTile value={`${correctPct}%`} label={t("Got it right")} />
              )}
              <StatTile value={avgTime} label={t("Avg. answer time")} />
            </div>
            {question && reveal && (
              <RevealDensity.Provider value={density}>
                <RevealBreakdown
                  question={question}
                  summary={reveal.summary}
                  hideCorrect={closed}
                />
              </RevealDensity.Provider>
            )}
            {!closed && reveal?.fastest && reveal.fastest.length > 0 && (
              <div className="mt-auto pt-3 border-t border-lprimary/15 dark:border-white/10">
                <span className={labelClass}>{t("Fastest right answers")}</span>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {reveal.fastest.map((f, i) => (
                    <div
                      key={f.playerId}
                      className="flex items-center gap-2 min-w-0 rounded-xl px-2.5 py-2 bg-green-500/8 border border-green-500/30 animate-fade-up"
                      style={{ animationDelay: `${300 + i * 150}ms` }}
                    >
                      <span className="text-lg shrink-0">
                        {["🥇", "🥈", "🥉"][i]}
                      </span>
                      <Image
                        src={f.profilePic || DEFAULT_AVATAR}
                        width={28}
                        height={28}
                        alt=""
                        className="size-7 shrink-0 rounded-full object-cover"
                      />
                      <span className="flex-1 min-w-0">
                        <b className="block truncate text-[13.5px]">{f.name}</b>
                        <span className={clsx("text-xs", mutedText)}>
                          {(f.timeMs / 1000).toFixed(1)} s
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
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
              <h3 className="text-xl md:text-[22px] font-bold">
                {t("Leaderboard")}
              </h3>
              <span className={clsx("text-[13.5px]", mutedText)}>
                {t(pl(leaderboard.length, "{n} player", "{n} players"), {
                  n: leaderboard.length,
                })}
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
                        aria-label={t("Remove {name} from this game", {
                          name: lead.name,
                        })}
                        title={t("Kick — can rejoin with the room code")}
                        disabled={removePlayerMutation.isPending}
                        onClick={() => handleKick(lead.playerId, lead.name)}
                        className="size-[30px] rounded-[9px] flex items-center justify-center text-off-dark dark:text-muted-dark hover:bg-[#e5544e]/14 hover:text-[#e5544e] transition-colors cursor-pointer"
                      >
                        <LuX size={17} />
                      </button>
                      <button
                        type="button"
                        aria-label={t("Ban {name} from this room", {
                          name: lead.name,
                        })}
                        title={t("Ban — blocked from rejoining this room")}
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
          title={t('You can also press "Space"')}
          disabled={advancing}
          onClick={() => {
            setAdvancing(true);
            socket.emit("host-next");
          }}
          className={clsx(primaryButtonClass, "w-full md:w-auto md:min-w-80")}
        >
          {closed
            ? closedNextLabel(moderation, qIndex, qCount, scoredQ)
            : nextIsScores
              ? t("Show scores")
              : isLastQuestion
                ? t("Final leaderboard")
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
        desc={t(
          "{name} will be removed and blocked from rejoining this room. The ban lasts until this room ends.",
          { name: playerToBan?.name ?? t("This player") },
        )}
        confirmLabel={t("Ban Player")}
        confirming={banPlayerMutation.isPending}
        confirmingLabel={t("Banning…")}
      />
    </div>
  );
}
