"use client";
import { useAppSelector } from "@/state/hooks";
import { useRouter } from "next/navigation";
import type { GameSession } from "@/types/db";
import {
  WaitGameStart,
  Question,
  Loader,
  Result,
  LeaderBoard,
} from "./GameScreens";
import { ScreenStatus } from "@/state/player/screenSlice";
import { usePlayerSocket } from "@/hooks/usePlayerSocket";

interface GameSessionWithQuiz extends GameSession {
  quiz: {
    title?: string;
    questions: { id: string; title?: string; options?: { id: string; title: string }[] }[];
  };
}

const GamePage = (params: { player: { id: string }; game: GameSessionWithQuiz }) => {
  const game = params.game;
  const router = useRouter();

  const screen = useAppSelector((state) => state.screen.screenStatus);
  const result = useAppSelector((state) => state.playerResult.resultStatus);

  const { socket, questionIndex, currentQuestion, stats } = usePlayerSocket({
    playerId: params.player.id,
    gameCode: game.gameCode,
    questions: game.quiz.questions,
    onRemoved: () => router.push("/player"),
  });

  return (
    <>
      {screen === ScreenStatus.lobby ? (
        <WaitGameStart player={params.player} game={params.game} />
      ) : screen === ScreenStatus.question ? (
        currentQuestion && socket ? (
          <Question
            question={{ ...currentQuestion, options: currentQuestion.options ?? [] }}
            gameSessionId={params.game.id}
            playerId={params.player.id}
            socket={socket}
            currentQuestion={questionIndex}
            quizTitle={game.quiz.title ?? ""}
            gameCode={params.game.gameCode}
          />
        ) : (
          <Loader />
        )
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
    </>
  );
};

export default GamePage;
