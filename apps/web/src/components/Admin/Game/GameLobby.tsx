"use client";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/state/hooks";
import { setPlayers } from "@/state/admin/playersSlice";
import type { Option } from "@/types/db";
import type { PlayerPayload } from "@buzrr/contract";
import { useAdminSocket } from "@/hooks/useAdminSocket";
import ConnectionBanner from "@/components/ConnectionBanner";
import { Progress } from "@/components/Game/GameUI";
import HostHeader, { headerPillClass } from "./HostHeader";
import GetReady from "@/components/Game/GetReady";
import QuestionScreen from "./QuestionScreen";
import QuesResult from "./QuesResult";
import LeaderBoard from "./Leaderboard";
import { ClosedSlide, ReadySlide } from "@/components/Game/ModeratedSteps";
import { closedNextLabel } from "@/lib/moderation";
import { isScoredType } from "@buzrr/contract";
import { ReactionOverlay } from "@/components/Game/Flyers";
import { GameSounds, LiveSounds, SoundToggle } from "@/lib/sound/director";

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
  logo?: string | null;
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

  // One sound provider for every phase: remounting it between the countdown
  // and the question screens restarted (or lost) the music.
  return (
    <GameSounds role="host" quizSettings={params.quizQuestions?.settings}>
      <LiveSounds socket={socket} />
      {!inGame ? (
        // idle / lobby / starting — the pre-question countdown
        <>
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
        </>
      ) : (
        // No site footer here: the game uses the full height (the admin
        // layout's footer padding is taken back with -mb-12).
        <div className="w-full max-w-7xl mx-auto flex flex-col px-4 sm:px-6 lg:px-8 -mb-12 min-h-[100dvh] md:min-h-0 md:h-[100dvh] text-dark dark:text-white">
          <ConnectionBanner />
          <ReactionOverlay
            socket={socket}
            nameOf={(id) => roster.find((p) => p.id === id)?.name}
          />
          <HostHeader
            title={title}
            logo={params.quizQuestions?.logo}
            roomId={params.roomId}
            alreadyEnded={alreadyEnded}
            middle={
              <>
                {(phase === "reveal" ||
                  phase === "scores" ||
                  phase === "ready") && (
                  <span
                    title="Game code"
                    className={`hidden sm:inline-flex shrink-0 ${headerPillClass}`}
                  >
                    <span className="font-medium opacity-60">Code</span>
                    <b className="font-extrabold tracking-[0.1em] text-lprimary dark:text-dprimary">
                      {params.gameCode}
                    </b>
                  </span>
                )}
                {qCount > 0 && (
                  <Progress
                    qIndex={qIndex}
                    qCount={qCount}
                    final={showLeaderboard}
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
          ) : phase === "closed" && closedSummary ? (
            // How the room answered; "Show answer" then marks the right one.
            <QuesResult
              key={`answer-${qIndex}`}
              socket={socket}
              roomId={params.roomId}
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
              )}
            />
          ) : phase === "reveal" || phase === "scores" ? (
            // "Show answer" keeps the tally on screen (same key as "closed"),
            // so only the right answer animates; "show scores" remounts it.
            <QuesResult
              key={phase === "reveal" ? `answer-${qIndex}` : `scores-${qIndex}`}
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
        </div>
      )}
    </GameSounds>
  );
};

export default GameLobby;
