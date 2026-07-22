"use client";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/state/hooks";
import { setPlayers } from "@/state/admin/playersSlice";
import type { Option } from "@/types/db";
import type { PlayerPayload } from "@/types/socket-events";
import { useAdminSocket } from "@/hooks/useAdminSocket";
import ConnectionBanner from "@/components/ConnectionBanner";
import ConnectionStatusPill from "@/components/ConnectionStatusPill";
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
  currentQues: number;
}) => {
  const dispatch = useAppDispatch();
  const phase = useAppSelector((state) => state.game.phase);

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

  return (
    <>
      {/* Always available to the host, on every in-game phase. */}
      <EndQuizButton roomId={params.roomId} alreadyEnded={alreadyEnded} />
      {socket && (
        <>
          <ConnectionBanner />
          <ConnectionStatusPill className="fixed left-3 bottom-3 z-40" />
          {phase === "question" ? (
            <QuestionScreen
              socket={socket}
              gameCode={params.gameCode}
              quizTitle={params.quizQuestions?.title}
            />
          ) : phase === "reveal" ? (
            <QuesResult socket={socket} />
          ) : showLeaderboard ? (
            <LeaderBoard />
          ) : (
            // idle / lobby / starting — the pre-question countdown screen
            <WaitScreen />
          )}
        </>
      )}
    </>
  );
};

export default GameLobby;
