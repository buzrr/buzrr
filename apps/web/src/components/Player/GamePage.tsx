"use client";
import { useEffect, useState } from "react";
import { useAppSelector } from "@/state/hooks";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import type { GameSession } from "@/types/db";
import {
  WaitGameStart,
  Question,
  Loader,
  Result,
  LeaderBoard,
} from "./GameScreens";
import ConnectionBanner from "@/components/ConnectionBanner";
import ConnectionStatusPill from "@/components/ConnectionStatusPill";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import { usePlayerSocket } from "@/hooks/usePlayerSocket";
import { playersApi } from "@/lib/modules/players/api";

interface GameSessionWithQuiz extends GameSession {
  quiz: {
    title?: string;
    questions: {
      id: string;
      title?: string;
      options?: { id: string; title: string }[];
    }[];
  };
  creator?: { name?: string | null; image?: string | null };
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
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const phase = useAppSelector((state) => state.game.phase);
  const question = useAppSelector((state) => state.game.question);
  const you = useAppSelector((state) => state.game.you);

  const { socket } = usePlayerSocket({
    playerId: params.player.id,
    gameCode: game.gameCode,
    // Kicked or banned: the player keeps their profile, so send them back to
    // the room-code screen (not "create a player") — they can join elsewhere,
    // or, if only kicked, be let back into this room by the host.
    onRemoved: ({ banned }) => {
      toast.error(
        banned
          ? "The host banned you from this room."
          : "The host removed you from this game.",
      );
      router.replace(`/player/joinRoom/${params.player.id}`);
    },
    onSessionEnded: () => router.push("/player"),
  });

  // Guard the browser/hardware back button: leaving the game is confirmed via
  // a modal instead of silently dropping the player on the previous screen.
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const onPopState = () => {
      window.history.pushState(null, "", window.location.href);
      setShowLeaveModal(true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const confirmLeave = () => {
    setShowLeaveModal(false);
    // Tell the server so the host's roster updates immediately; the HTTP
    // clear-game also detaches the player in Postgres and is the reliable
    // fallback when the socket is down. Both are fire-and-forget — invalidating
    // the play query here would flip gameId to null mid-render and race the
    // navigation. The saved player identity is kept, so the next screen is the
    // room-code step, not create-profile.
    if (socket?.connected) socket.emit("leave-room");
    void playersApi.clearGame(params.player.id).catch(() => {});
    router.replace(`/player/joinRoom/${params.player.id}`);
  };

  return (
    <>
      <ConnectionBanner />
      <ConnectionStatusPill className="fixed left-3 bottom-3 z-40" />
      <ConfirmationModal
        open={showLeaveModal}
        setOpen={setShowLeaveModal}
        onClick={confirmLeave}
        desc="If you leave now you'll be removed from this game. Your name is saved — you can rejoin with the room code."
        confirmLabel="Leave Game"
      />
      {phase === "idle" || phase === "lobby" ? (
        <WaitGameStart
          player={params.player}
          game={params.game}
          onLeave={() => setShowLeaveModal(true)}
        />
      ) : phase === "question" ? (
        question && socket ? (
          <Question
            question={question}
            socket={socket}
            quizTitle={game.quiz.title ?? ""}
            gameCode={game.gameCode}
            hostName={game.creator?.name}
            hostImage={game.creator?.image}
          />
        ) : (
          <Loader />
        )
      ) : phase === "reveal" ? (
        <Result
          you={you}
          gameCode={game.gameCode}
          quizTitle={game.quiz.title ?? ""}
          hostName={game.creator?.name}
          hostImage={game.creator?.image}
        />
      ) : phase === "final" || phase === "ended" ? (
        <LeaderBoard
          position={you?.rank ?? null}
          score={you?.totalScore ?? 0}
        />
      ) : (
        // "starting" — the pre-question countdown
        <Loader />
      )}
    </>
  );
};

export default GamePage;
