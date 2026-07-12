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
import ConnectionBanner from "@/components/ConnectionBanner";
import { usePlayerSocket } from "@/hooks/usePlayerSocket";

interface GameSessionWithQuiz extends GameSession {
  quiz: {
    title?: string;
    questions: {
      id: string;
      title?: string;
      options?: { id: string; title: string }[];
    }[];
  };
}

/**
 * Pure phase switch driven by server-pushed state. The question payload
 * arrives over the socket (`question-start` / `state-sync`), so no quiz
 * pre-fetch is needed for gameplay.
 */
const GamePage = (params: {
  player: { id: string };
  game: GameSessionWithQuiz;
}) => {
  const game = params.game;
  const router = useRouter();

  const phase = useAppSelector((state) => state.game.phase);
  const question = useAppSelector((state) => state.game.question);
  const you = useAppSelector((state) => state.game.you);

  const { socket } = usePlayerSocket({
    playerId: params.player.id,
    gameCode: game.gameCode,
    onRemoved: () => router.push("/player"),
  });

  return (
    <>
      <ConnectionBanner />
      {phase === "idle" || phase === "lobby" ? (
        <WaitGameStart player={params.player} game={params.game} />
      ) : phase === "question" ? (
        question && socket ? (
          <Question
            question={question}
            socket={socket}
            quizTitle={game.quiz.title ?? ""}
            gameCode={game.gameCode}
          />
        ) : (
          <Loader />
        )
      ) : phase === "reveal" ? (
        <Result
          you={you}
          gameCode={game.gameCode}
          quizTitle={game.quiz.title ?? ""}
        />
      ) : phase === "final" || phase === "ended" ? (
        <LeaderBoard position={you?.rank ?? null} score={you?.totalScore ?? 0} />
      ) : (
        // "starting" — the pre-question countdown
        <Loader />
      )}
    </>
  );
};

export default GamePage;
