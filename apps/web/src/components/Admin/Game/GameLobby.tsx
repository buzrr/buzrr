"use client";
import { useHostHotkeys } from "@/hooks/useHostHotkeys";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** How long the game screen waits for a "start" before returning to the lobby. */
const LOBBY_BOUNCE_MS = 5000;
import { useAppDispatch, useAppSelector } from "@/state/hooks";
import { setPlayers } from "@/state/admin/playersSlice";
import type { Option } from "@/types/db";
import type { PlayerPayload } from "@buzrr/contract";
import { useAdminSocket } from "@/hooks/useAdminSocket";
import ConnectionBanner from "@/components/ConnectionBanner";
import { Progress } from "@/components/Game/GameUI";
import HostHeader, { HostControls, headerPillClass } from "./HostHeader";
import GetReady from "@/components/Game/GetReady";
import QuestionScreen from "./QuestionScreen";
import QuesResult from "./QuesResult";
import LeaderBoard from "./Leaderboard";
import { ClosedSlide, ReadySlide } from "@/components/Game/ModeratedSteps";
import { closedNextLabel } from "@/lib/moderation";
import { isScoredType, revealHasPoint } from "@buzrr/contract";
import { ReactionOverlay } from "@/components/Game/Flyers";

interface QuizQuestionItem {
  title?: string;
  options?: Option[];
  id?: string;
  media?: string | null;
  mediaType?: string | null;
}

interface QuizQuestion {
  id?: string;
  title?: string;
  questions?: QuizQuestionItem[];
}

/**
 * Pure phase switch: the server pushes the current phase and this component
 * renders it. No timers or advancement decisions live on the client anymore.
 */
const GameLobby = (params: {
  roomId: string;
  userId: string;
  gameCode: string;
  players: PlayerPayload[];
  quizQuestions: QuizQuestion;
}) => {
  // Space: the next button on screen; Escape: skip / go on.
  useHostHotkeys();
  const dispatch = useAppDispatch();
  const phase = useAppSelector((state) => state.game.phase);
  const router = useRouter();
  // The game screen of a room that never started (the start got lost —
  // e.g. a server restart): after a grace period for the start to land, the
  // host goes back to the waiting room and its Start button.
  useEffect(() => {
    if (phase !== "lobby") return;
    const tm = setTimeout(
      () => router.replace(`/admin/play/${params.roomId}`),
      LOBBY_BOUNCE_MS,
    );
    return () => clearTimeout(tm);
  }, [phase, router, params.roomId]);
  const qIndex = useAppSelector((state) => state.game.qIndex);
  const qCount = useAppSelector((state) => state.game.qCount);
  const moderation = useAppSelector((state) => state.game.moderation);
  const question = useAppSelector((state) => state.game.question);
  const roster = useAppSelector((state) => state.game.players);

  useEffect(() => {
    dispatch(setPlayers(params.players));
  }, [dispatch, params.players]);

  const { socket } = useAdminSocket({
    gameCode: params.gameCode,
  });

  // The final leaderboard shows for both phases, but a classic game only
  // persists its GameResult when endGame runs. At "final" that hasn't happened
  // yet, so the button must still end (and save); only "ended" is a plain exit.
  const showLeaderboard = phase === "final" || phase === "ended";
  const alreadyEnded = phase === "ended";
  const inGame =
    phase === "question" ||
    phase === "reveal" ||
    phase === "ready" ||
    phase === "closed" ||
    phase === "scores" ||
    showLeaderboard;
  const title = params.quizQuestions?.title ?? "Quiz";

  if (!socket) return null;

  // Fewer than two players: a try-out — "End" goes back to editing the quiz.
  const endRedirect =
    roster.length < 2 && params.quizQuestions?.id
      ? `/admin/quiz/${params.quizQuestions.id}`
      : undefined;
  const codePill = (
    <span title="Game code" className={`shrink-0 ${headerPillClass}`}>
      <span className="font-medium opacity-60">Code</span>
      <b className="font-extrabold tracking-[0.1em] text-lprimary dark:text-dprimary">
        {params.gameCode}
      </b>
    </span>
  );

  if (!inGame) {
    // idle / lobby / starting — the pre-question countdown
    return (
      <>
        <ConnectionBanner />
        <ReactionOverlay
          socket={socket}
          nameOf={(id) => roster.find((p) => p.id === id)?.name}
        />
        <GetReady
          title={title}
          onSkip={
            roster.some((p) => p.connected)
              ? undefined
              : () => socket.emit("host-next")
          }
        />
      </>
    );
  }

  return (
    // No site footer here: the game uses the full height (the admin
    // layout's footer padding is taken back with -mb-12).
    <div className="w-full flex flex-col px-4 sm:px-6 lg:px-8 -mb-12 min-h-[100dvh] md:min-h-0 md:h-[100dvh] text-dark dark:text-white">
      <ConnectionBanner />
      <ReactionOverlay
        socket={socket}
        nameOf={(id) => roster.find((p) => p.id === id)?.name}
      />
      <HostHeader
        title={title}
        roomId={params.roomId}
        alreadyEnded={alreadyEnded}
        endRedirect={endRedirect}
        controlsBelowOnPhone
        middle={
          <>
            {(phase === "reveal" ||
              phase === "scores" ||
              phase === "ready") && (
              <span className="hidden md:inline-flex">{codePill}</span>
            )}
            {qCount > 0 && (
              <Progress
                qIndex={qIndex}
                qCount={qCount}
                final={showLeaderboard}
                compact
              />
            )}
          </>
        }
      />
      {phase === "question" ? (
        <QuestionScreen socket={socket} gameCode={params.gameCode} />
      ) : phase === "ready" ? (
        <ReadySlide
          key={`ready-${qIndex}`}
          onNext={() => socket.emit("host-next")}
        />
      ) : phase === "closed" ? (
        <ClosedSlide
          key={`closed-${qIndex}`}
          onNext={() => socket.emit("host-next")}
          nextLabel={closedNextLabel(
            moderation,
            qIndex,
            qCount,
            question ? isScoredType(question.type) : true,
            question ? revealHasPoint(question) : true,
          )}
        />
      ) : phase === "reveal" || phase === "scores" ? (
        // "Show standings" keeps the answer on screen and adds the
        // standings beside it.
        <QuesResult
          key={`answer-${qIndex}`}
          socket={socket}
          roomId={params.roomId}
        />
      ) : (
        <LeaderBoard
          roomId={params.roomId}
          quizTitle={title}
          alreadyEnded={alreadyEnded}
          quizId={params.quizQuestions?.id}
        />
      )}
      {/* Phones: the room goes to the game; code, Live and "End" wait
          at the very end of the page. */}
      <div className="md:hidden flex flex-wrap items-center justify-center gap-2 pt-4 pb-5">
        {codePill}
        <HostControls
          roomId={params.roomId}
          endRedirect={endRedirect}
          alreadyEnded={alreadyEnded}
        />
      </div>
    </div>
  );
};

export default GameLobby;
