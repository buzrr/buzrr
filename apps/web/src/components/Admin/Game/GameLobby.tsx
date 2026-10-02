"use client";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/state/hooks";
import { setPlayers } from "@/state/admin/playersSlice";
import type { Option } from "@/types/db";
import type { PlayerPayload } from "@/types/socket-events";
import { useAdminSocket } from "@/hooks/useAdminSocket";
import ConnectionBanner from "@/components/ConnectionBanner";
import { GameTopBar } from "@/components/Game/GameUI";
import EndQuizButton from "@/components/Admin/EndQuizButton";
import WaitScreen from "./WaitScreen";
import QuestionScreen from "./QuestionScreen";
import QuesResult from "./QuesResult";
import LeaderBoard from "./Leaderboard";

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
  const dispatch = useAppDispatch();
  const phase = useAppSelector((state) => state.game.phase);
  const qIndex = useAppSelector((state) => state.game.qIndex);
  const qCount = useAppSelector((state) => state.game.qCount);

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
  const inGame = phase === "question" || phase === "reveal" || showLeaderboard;
  const title = params.quizQuestions?.title ?? "Quiz";

  if (!socket) return null;

  if (!inGame) {
    // idle / lobby / starting — the full-screen pre-question countdown
    return (
      <>
        <ConnectionBanner />
        <WaitScreen />
      </>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col px-4 sm:px-6 lg:px-8 pb-16 md:pb-0 md:h-[calc(100dvh-7rem)] text-dark dark:text-white">
      <ConnectionBanner />
      <GameTopBar
        title={title}
        qIndex={qIndex}
        qCount={qCount}
        final={showLeaderboard}
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
      ) : phase === "reveal" ? (
        <QuesResult socket={socket} roomId={params.roomId} />
      ) : (
        <LeaderBoard
          roomId={params.roomId}
          quizTitle={title}
          alreadyEnded={alreadyEnded}
        />
      )}
    </div>
  );
};

export default GameLobby;
