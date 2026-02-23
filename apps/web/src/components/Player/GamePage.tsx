"use client";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/state/store";
import { useRouter } from "next/navigation";
import type { GameSession } from "@/types/db";
import {
  WaitGameStart,
  Question,
  Loader,
  Result,
  LeaderBoard,
} from "./GameScreens";
import { ScreenStatus, setScreenStatus } from "@/state/player/screenSlice";
import { ResultStatus, setResultStatus } from "@/state/player/resultSlice";

interface PlayerWithId {
  id: string;
  [key: string]: unknown;
}

interface GameSessionWithQuiz extends GameSession {
  quiz: {
    title?: string;
    questions: { id: string; title?: string; options?: { id: string; title: string }[]; [key: string]: unknown }[];
  };
}

const GamePage = (params: { player: PlayerWithId; game: GameSessionWithQuiz }) => {
  const game = params.game;
  const [question, setQuestion] = useState(
    game.quiz.questions[game.currentQuestion],
  );
  const [questionIndex, setQuestionIndex] = useState(game.currentQuestion);
  const [socketState, setSocketState] = useState<Socket>({} as Socket);
  const [stats, setStats] = useState<{
    position: number | null;
    score: number;
  }>({ position: null, score: 0 });

  const screen = useSelector((state: RootState) => state.screen.screenStatus);
  const result = useSelector(
    (state: RootState) => state.playerResult.resultStatus,
  );
  const dispatch = useDispatch();

  const router = useRouter();
  useEffect(() => {
    if (window !== undefined) {
      const socket = io(
        `${process.env.NEXT_PUBLIC_SOCKET_URL}/?userType=player&playerId=${params.player.id}&gameCode=${params.game.gameCode}`,
      );

      socket.on("connect", () => {
        console.log("Connected to socket server");
        setSocketState(socket);
      });

      socket.on("player-removed", (player: PlayerWithId) => {
        if (player.id === params.player.id) {
          window.localStorage.removeItem("playerId");
          router.push("/player");
        }
      });

      socket.on("game-started", () => {
        dispatch(setScreenStatus(ScreenStatus.wait));
      });

      socket.on("timer-starts", () => {
        dispatch(setScreenStatus(ScreenStatus.wait));
      });

      socket.on("get-question-index", (index: number) => {
        console.log("Question index", index);
        setQuestionIndex(index);
        setQuestion(game.quiz.questions[index]);
        dispatch(setScreenStatus(ScreenStatus.question));
      });

      socket.on("displaying-result", (data: { player?: { playerId: string; isCorrect?: boolean }[] }) => {
        console.log("Displaying result", data);

        // set result
        const playerAnswers = data.player ?? [];

        let playerAnswered = false;

        playerAnswers.forEach((player: { playerId: string; isCorrect?: boolean }) => {
          if (player.playerId === params.player.id) {
            dispatch(
              setResultStatus(
                player.isCorrect
                  ? ResultStatus.correct
                  : ResultStatus.incorrect,
              ),
            );
            playerAnswered = true;
            return;
          }
        });

        if (!playerAnswered) dispatch(setResultStatus(ResultStatus.timeout));

        dispatch(setScreenStatus(ScreenStatus.result));
      });

      socket.on("game-session-ended", () => {
        dispatch(setScreenStatus(ScreenStatus.lobby));
        router.push("/player");
      });

      socket.on("displaying-final-leaderboard", (leaderboard: { playerId: string; position: number; score: number }[]) => {
        leaderboard.forEach((player) => {
          if (player.playerId === params.player.id) {
            setStats({ position: player.position, score: player.score });
          }
        });
        dispatch(setScreenStatus(ScreenStatus.leaderboard));
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [
    dispatch,
    params.game.gameCode,
    params.player,
    game.quiz.questions,
    router,
  ]);

  return (
    <>
      {/* <div className="flex flex-col justify-center items-center h-full w-full md:px-4 mx-auto md:my-4"> */}
      {screen === ScreenStatus.lobby ? (
        <WaitGameStart player={params.player} game={params.game} />
      ) : screen === ScreenStatus.question ? (
        <Question
          question={question ? { ...question, options: question.options ?? [] } : { id: "", options: [] }}
          gameSessionId={params.game.id}
          playerId={params.player.id ?? ""}
          socket={socketState}
          currentQuestion={questionIndex}
          quizTitle={game.quiz.title ?? ""}
          gameCode={params.game.gameCode}
        />
      ) : screen === ScreenStatus.result ? (
        <Result
          result={result}
          gameCode={params.game.gameCode}
          quizTitle={game.quiz.title ?? ""}
        />
      ) : screen === ScreenStatus.wait ? (
        <Loader />
      ) : (
        <LeaderBoard position={stats.position} score={stats.score} />
      )}
      {/* </div> */}
    </>
  );
};

export default GamePage;
