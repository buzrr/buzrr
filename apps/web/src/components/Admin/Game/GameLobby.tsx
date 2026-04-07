"use client";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/state/hooks";
import { setPlayers } from "@/state/admin/playersSlice";
import { ScreenStatus } from "@/state/admin/screenSlice";
import type { Option } from "@/types/db";
import type { PlayerPayload } from "@/types/socket-events";
import { useAdminSocket } from "@/hooks/useAdminSocket";
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

const GameLobby = (params: {
  roomId: string;
  userId: string;
  gameCode: string;
  players: PlayerPayload[];
  quizQuestions: QuizQuestion;
  currentQues: number;
}) => {
  const dispatch = useAppDispatch();
  const socket = useAppSelector((state) => state.socket.socket);
  const screen = useAppSelector((state) => state.adminScreen.screenStatus);

  useEffect(() => {
    dispatch(setPlayers(params.players));
  }, [dispatch, params.players]);

  useAdminSocket({
    userId: params.userId,
    gameCode: params.gameCode,
  });

  if (!socket) {
    return null;
  }

  return (
    <>
      {screen === ScreenStatus.wait ? (
        <WaitScreen
          currentQues={params.currentQues}
          socket={socket}
          gameCode={params.gameCode}
        />
      ) : screen === ScreenStatus.question ? (
        <QuestionScreen {...params} socket={socket} />
      ) : screen === ScreenStatus.result ? (
        <QuesResult {...params} socket={socket} />
      ) : (
        screen === ScreenStatus.leaderboard && (
          <LeaderBoard {...params} socket={socket} />
        )
      )}
    </>
  );
};

export default GameLobby;
