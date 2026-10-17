"use client";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/state/hooks";
import { setPlayers } from "@/state/admin/playersSlice";
import type { Option } from "@/types/db";
import type { PlayerPayload } from "@buzrr/contract";
import { useAdminSocket } from "@/hooks/useAdminSocket";
import ConnectionBanner from "@/components/ConnectionBanner";
import { GameTopBar } from "@/components/Game/GameUI";
import EndQuizButton from "@/components/Admin/EndQuizButton";
import GetReady from "@/components/Game/GetReady";
import QuestionScreen from "./QuestionScreen";
import QuesResult from "./QuesResult";
import LeaderBoard from "./Leaderboard";
import { ClosedSlide, ReadySlide } from "@/components/Game/ModeratedSteps";
import { closedNextLabel } from "@/lib/moderation";
import { ReactionOverlay } from "@/components/Game/Flyers";
import { GameSounds, SoundToggle } from "@/lib/sound/director";

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
  settings?: unknown;
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
  const dispatch = useAppDispatch();
  const phase = useAppSelector((state) => state.game.phase);
  const qIndex = useAppSelector((state) => state.game.qIndex);
  const qCount = useAppSelector((state) => state.game.qCount);
  const moderation = useAppSelector((state) => state.game.moderation);
  const closedSummary = useAppSelector((state) => state.game.closedSummary);
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

  if (!inGame) {
    // idle / lobby / starting — the pre-question countdown
    return (
      <GameSounds role="host" quizSettings={params.quizQuestions?.settings}>
        <SoundToggle />
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
      </GameSounds>
    );
  }

  return (
    <GameSounds role="host" quizSettings={params.quizQuestions?.settings}>
      <SoundToggle />
      {/* No site footer here: the game uses the full height (the admin
          layout's footer padding is taken back with -mb-12). */}
      <div className="w-full max-w-7xl mx-auto flex flex-col px-4 sm:px-6 lg:px-8 -mb-12 min-h-[calc(100dvh-1rem)] md:min-h-0 md:h-[calc(100dvh-6rem)] text-dark dark:text-white">
        <ConnectionBanner />
        <ReactionOverlay
          socket={socket}
          nameOf={(id) => roster.find((p) => p.id === id)?.name}
        />
        <GameTopBar
          title={title}
          qIndex={qIndex}
          qCount={qCount}
          final={showLeaderboard}
          gameCode={
            phase === "reveal" || phase === "scores" || phase === "ready"
              ? params.gameCode
              : undefined
          }
          right={
            <EndQuizButton
              inline
              roomId={params.roomId}
              alreadyEnded={alreadyEnded}
            />
          }
        />
        {phase === "question" ? (
          <QuestionScreen socket={socket} gameCode={params.gameCode} />
        ) : phase === "ready" ? (
          <ReadySlide
            key={`ready-${qIndex}`}
            onNext={() => socket.emit("host-next")}
          />
        ) : phase === "closed" && closedSummary ? (
          // How the room answered; "Show answer" then marks the right one.
          <QuesResult
            key={`closed-${qIndex}`}
            socket={socket}
            roomId={params.roomId}
          />
        ) : phase === "closed" ? (
          <ClosedSlide
            key={`closed-${qIndex}`}
            onNext={() => socket.emit("host-next")}
            nextLabel={closedNextLabel(moderation, qIndex, qCount)}
          />
        ) : phase === "reveal" || phase === "scores" ? (
          // Keyed by step: "show scores" remounts it so the standings animate.
          <QuesResult
            key={`${phase}-${qIndex}`}
            socket={socket}
            roomId={params.roomId}
          />
        ) : (
          <LeaderBoard
            roomId={params.roomId}
            quizTitle={title}
            alreadyEnded={alreadyEnded}
          />
        )}
      </div>
    </GameSounds>
  );
};

export default GameLobby;
