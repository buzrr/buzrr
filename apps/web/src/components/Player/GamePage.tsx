"use client";
import { useEffect, useRef, useState } from "react";
import { useAppSelector } from "@/state/hooks";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import type { GameSession } from "@/types/db";
import { WaitGameStart, Question, Result, LeaderBoard } from "./GameScreens";
import ConnectionBanner from "@/components/ConnectionBanner";
import GetReady from "@/components/Game/GetReady";
import {
  ClosedSlide,
  PlayerScores,
  ReadySlide,
} from "@/components/Game/ModeratedSteps";
import ConnectionStatusPill from "@/components/ConnectionStatusPill";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import { usePlayerSocket } from "@/hooks/usePlayerSocket";
import { ReactionBar } from "@/components/Game/Flyers";
import { GameSounds, SoundToggle } from "@/lib/sound/director";
import { SCORES_EMOJI_TOP, quizSettingsSchema } from "@buzrr/contract";
import { playersApi } from "@/lib/modules/players/api";
import { saveFinalResult } from "@/lib/final-result";

interface GameSessionWithQuiz extends GameSession {
  quiz: {
    title?: string;
    settings?: unknown;
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
/** On the final standings the top this many get a blinking emoji bar. */
const FINAL_BLINK_TOP = 15;

const GamePage = (params: {
  player: { id: string };
  game: GameSessionWithQuiz;
}) => {
  const game = params.game;
  const router = useRouter();
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const phase = useAppSelector((state) => state.game.phase);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  });
  const leaderboard = useAppSelector((state) => state.game.leaderboard);
  const playerCount =
    useAppSelector((state) => state.game.leaderboardTotal) ??
    leaderboard.length;
  // Our row when we're on the board's top; below it the place and points
  // come from answer-result (`you.rank` / `you.totalScore`, used below).
  const mine = leaderboard.find((e) => e.playerId === params.player.id);
  const question = useAppSelector((state) => state.game.question);
  const you = useAppSelector((state) => state.game.you);
  const qIndex = useAppSelector((state) => state.game.qIndex);
  const moderation = useAppSelector((state) => state.game.moderation);
  const finalRevealInMs = useAppSelector((state) => state.game.finalRevealInMs);
  // The final standings: moderated, the place (and the podium's emoji call)
  // waits until the host's board has re-sorted and filled the podium — the
  // server says when (nothing to wait for after a reconnect).
  const [finalRevealed, setFinalRevealed] = useState(false);
  const atFinal = phase === "final" || phase === "ended";
  useEffect(() => {
    if (!atFinal) return;
    const wait = moderation && phase === "final" ? (finalRevealInMs ?? 0) : 0;
    const t = setTimeout(() => setFinalRevealed(true), wait);
    return () => clearTimeout(t);
  }, [atFinal, phase, moderation, finalRevealInMs]);
  const finalRank =
    finalRevealed && atFinal ? (mine?.rank ?? you?.rank ?? null) : null;
  // The question whose board got this player's emoji: the bar stays away
  // while that board (reveal, scores) is on screen.
  const [boardEmojiQ, setBoardEmojiQ] = useState<number | null>(null);
  const sentToBoard =
    (phase === "reveal" || phase === "scores") && boardEmojiQ === qIndex;

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
    // After the final leaderboard the thank-you screen stays put when the
    // host closes the room; only a room that ends earlier sends players back.
    onSessionEnded: () => {
      if (phaseRef.current !== "final" && phaseRef.current !== "ended") {
        router.replace(`/player/joinRoom/${params.player.id}`);
      }
    },
  });

  // Keep the final result for the thank-you screen (survives the room).
  useEffect(() => {
    if ((phase === "final" || phase === "ended") && leaderboard.length > 0) {
      saveFinalResult({
        playerId: params.player.id,
        quizTitle: game.quiz.title ?? "",
        position: mine?.rank ?? you?.rank ?? null,
        score: mine?.score ?? you?.totalScore ?? 0,
        players: playerCount,
      });
    }
  }, [
    phase,
    leaderboard,
    playerCount,
    mine,
    you,
    params.player.id,
    game.quiz.title,
  ]);

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

  const settings = quizSettingsSchema.safeParse(game.quiz.settings ?? {});
  const reactionsOn = settings.success ? settings.data.reactions : true;

  return (
    <GameSounds role="player" quizSettings={game.quiz.settings}>
      <SoundToggle />
      <ConnectionBanner />
      {reactionsOn &&
        phase !== "ended" &&
        phase !== "idle" &&
        phase !== "lobby" &&
        (sentToBoard ? null : phase === "scores" ? (
          // The scores step: the top SCORES_EMOJI_TOP send one emoji each,
          // shown on their row of the host's board.
          you?.rank != null &&
          you.rank <= SCORES_EMOJI_TOP && (
            <ReactionBar
              key={`scores-${qIndex}`}
              socket={socket}
              oneShot
              onSent={() => setBoardEmojiQ(qIndex)}
            />
          )
        ) : phase === "reveal" && you?.isCorrect ? (
          // "Right!": the first emoji goes onto their row of the board.
          <ReactionBar
            key={`reveal-${qIndex}`}
            socket={socket}
            oneShot
            onSent={() => setBoardEmojiQ(qIndex)}
          />
        ) : (
          <ReactionBar
            socket={socket}
            // The final standings' top: an eye-catching bar — the podium is
            // asked to share.
            blink={finalRank !== null && finalRank <= FINAL_BLINK_TOP}
            hint={
              finalRank !== null && finalRank <= 3
                ? "Share your emojis now!"
                : undefined
            }
          />
        ))}
      {phase !== "question" && phase !== "reveal" && phase !== "closed" && (
        <ConnectionStatusPill className="fixed left-3 bottom-3 z-40" />
      )}
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
          onBubbleStats={(stats) => {
            if (socket?.connected) socket.emit("bubble-stats", stats);
          }}
          reactionBar={
            reactionsOn ? <ReactionBar socket={socket} inline /> : undefined
          }
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
          <GetReady title={game.quiz.title ?? undefined} />
        )
      ) : phase === "ready" ? (
        <ReadySlide />
      ) : phase === "closed" ? (
        <ClosedSlide />
      ) : phase === "scores" ? (
        <PlayerScores playerId={params.player.id} />
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
          playerId={params.player.id}
          position={mine?.rank ?? you?.rank ?? null}
          score={mine?.score ?? you?.totalScore ?? 0}
          quizTitle={game.quiz.title ?? undefined}
          players={playerCount}
          held={!finalRevealed}
        />
      ) : (
        // "starting" — the pre-question countdown
        <GetReady title={game.quiz.title ?? undefined} />
      )}
    </GameSounds>
  );
};

export default GamePage;
