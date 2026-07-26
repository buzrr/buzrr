"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { DEFAULT_AVATAR } from "@/constants";
import { useAppSelector } from "@/state/hooks";
import { useGameSocket } from "@/hooks/useGameSocket";
import { useServerCountdown } from "@/hooks/useServerCountdown";
import { useDuelProfileQuery } from "@/lib/modules/duel/hooks";
import { fetchApiAccessToken } from "@/lib/api/get-access-token";
import ConfettiBurst from "@/components/ConfettiBurst";
import ConnectionBanner from "@/components/ConnectionBanner";
import { Button } from "@/components/ui/Button";
import { Question, Result, Loader } from "@/components/Player/GameScreens";
import ReportQuestionButton from "./ReportQuestionButton";
import DuelAudio, { type DuelOutcome } from "./DuelAudio";

export default function DuelGameClient({ gameCode }: { gameCode: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const { data: profile } = useDuelProfileQuery();

  useEffect(() => {
    fetchApiAccessToken()
      .then((t) => (t ? setToken(t) : setTokenError(true)))
      .catch(() => setTokenError(true));
  }, []);

  const { socket } = useGameSocket({
    userType: "duel",
    gameCode,
    token: token ?? undefined,
  });

  const phase = useAppSelector((state) => state.game.phase);
  const question = useAppSelector((state) => state.game.question);
  const you = useAppSelector((state) => state.game.you);
  const leaderboard = useAppSelector((state) => state.game.leaderboard);

  const outcome = useMemo<DuelOutcome | null>(() => {
    const myId = profile?.id;
    if (!myId) return null;
    const me = leaderboard.find((e) => e.playerId === myId);
    const opponent = leaderboard.find((e) => e.playerId !== myId);
    if (!me || !opponent) return null;
    return me.score === opponent.score
      ? "tie"
      : me.score > opponent.score
        ? "win"
        : "defeat";
  }, [leaderboard, profile?.id]);

  if (tokenError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70dvh] gap-4 px-4 text-center">
        <p className="text-dark dark:text-white">
          Couldn&apos;t start the duel. Please sign in and try again.
        </p>
        <Link href="/duel">
          <Button>Back to Duel</Button>
        </Link>
      </div>
    );
  }

  if (!token || !socket) return <Loader />;

  return (
    <>
      <ConnectionBanner />
      <DuelAudio outcome={outcome} />
      <DuelScoreBar myId={profile?.id} />
      {phase === "question" ? (
        question ? (
          <>
            <div className="fixed top-3 right-3 z-40">
              <ReportQuestionButton questionId={question.id} />
            </div>
            <Question
              question={question}
              socket={socket}
              quizTitle="1v1 Duel"
              gameCode={gameCode}
              hideRoomCode
            />
          </>
        ) : (
          <Loader />
        )
      ) : phase === "reveal" ? (
        <Result
          you={you}
          gameCode={gameCode}
          quizTitle="1v1 Duel"
          hideRoomCode
        />
      ) : phase === "final" || phase === "ended" ? (
        <DuelResultScreen myId={profile?.id} />
      ) : (
        <DuelStartingScreen gameCode={gameCode} myId={profile?.id} />
      )}
    </>
  );
}

/** Persistent header: both players' live scores and connection dots. */
function DuelScoreBar({ myId }: { myId?: string }) {
  const players = useAppSelector((state) => state.game.players);
  const leaderboard = useAppSelector((state) => state.game.leaderboard);
  const phase = useAppSelector((state) => state.game.phase);

  const scores = useMemo(() => {
    const byId = new Map(leaderboard.map((e) => [e.playerId, e.score]));
    return players.map((p) => ({ ...p, score: byId.get(p.id) ?? 0 }));
  }, [players, leaderboard]);

  if (phase === "final" || phase === "ended" || scores.length === 0) {
    return null;
  }

  const me = scores.find((p) => p.id === myId);
  const others = scores.filter((p) => p.id !== myId);
  const ordered = me ? [me, ...others] : scores;

  return (
    <div className="flex items-center justify-center gap-4 py-3 px-4">
      {ordered.map((p, index) => (
        <div key={p.id} className="flex items-center gap-4">
          {index > 0 && (
            <span className="font-black text-off-dark dark:text-off-white">
              VS
            </span>
          )}
          <div className="flex items-center gap-2 bg-white dark:bg-dark rounded-full py-1 pl-1 pr-4 shadow">
            <span className="relative">
              <Image
                src={p.profilePic || DEFAULT_AVATAR}
                width={36}
                height={36}
                alt={p.name}
                className="rounded-full h-9 w-9"
              />
              <span
                className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white ${
                  p.connected ? "bg-green-500" : "bg-gray"
                }`}
              />
            </span>
            <div>
              <p className="text-xs font-bold text-dark dark:text-white leading-tight">
                {p.id === myId ? "You" : p.name}
              </p>
              <p
                key={p.score}
                className="text-sm font-black text-lprimary dark:text-dprimary leading-tight animate-pop"
              >
                {p.score}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DuelStartingScreen({
  gameCode,
  myId,
}: {
  gameCode: string;
  myId?: string;
}) {
  const players = useAppSelector((state) => state.game.players);
  const deadline = useAppSelector((state) => state.game.deadline);
  const clockOffset = useAppSelector((state) => state.game.clockOffset);
  const remaining = Math.ceil(useServerCountdown(deadline, clockOffset));

  const opponent =
    players.find((p) => p.id !== myId) ?? readStoredOpponent(gameCode);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70dvh] gap-6 px-4">
      <p className="text-2xl font-black text-dark dark:text-white animate-fade-up">
        {opponent ? `You vs ${opponent.name}` : "Get ready!"}
      </p>
      <p
        key={remaining}
        className="text-7xl font-black text-lprimary dark:text-dprimary animate-pop-in"
      >
        {remaining > 0 ? remaining : "GO!"}
      </p>
    </div>
  );
}

function DuelResultScreen({ myId }: { myId?: string }) {
  const leaderboard = useAppSelector((state) => state.game.leaderboard);
  const eloChanges = useAppSelector((state) => state.game.eloChanges);
  const rated = useAppSelector((state) => state.game.rated);

  const me = leaderboard.find((e) => e.playerId === myId);
  const opponent = leaderboard.find((e) => e.playerId !== myId);
  const myElo = myId ? eloChanges?.[myId] : undefined;

  const won = Boolean(me && opponent && me.score > opponent.score);
  const outcome =
    !me || !opponent
      ? "Duel over"
      : me.score === opponent.score
        ? "It's a tie!"
        : won
          ? "You won! 🏆"
          : "You lost";

  return (
    <div className="flex flex-col items-center justify-center min-h-[80dvh] gap-6 px-4">
      {won && <ConfettiBurst />}
      <p className="text-3xl sm:text-4xl font-black text-dark dark:text-white text-center animate-pop-in">
        {outcome}
      </p>

      <div className="flex items-center gap-6 sm:gap-8 animate-fade-up [animation-delay:150ms]">
        {[me, opponent].filter(Boolean).map((entry) => (
          <div
            key={entry!.playerId}
            className="flex flex-col items-center gap-2"
          >
            <Image
              src={entry!.profilePic || DEFAULT_AVATAR}
              width={64}
              height={64}
              alt={entry!.name}
              className="rounded-full h-16 w-16"
            />
            <p className="font-bold text-dark dark:text-white">
              {entry!.playerId === myId ? "You" : entry!.name}
            </p>
            <p className="text-2xl font-black text-lprimary dark:text-dprimary">
              {entry!.score}
            </p>
          </div>
        ))}
      </div>

      {!rated && (
        <p className="text-sm text-off-dark dark:text-off-white text-center animate-fade-up [animation-delay:300ms]">
          Friendly duel — rating unaffected
        </p>
      )}

      {rated && myElo && (
        <div className="bg-white dark:bg-dark rounded-2xl px-6 py-4 shadow border border-card-light dark:border-off-dark text-center animate-fade-up [animation-delay:300ms]">
          <p className="text-xs text-off-dark dark:text-off-white mb-1">
            Rating
          </p>
          <p className="text-xl font-black text-dark dark:text-white">
            {myElo.before} →{" "}
            <span
              className={
                myElo.after >= myElo.before
                  ? "text-green-600"
                  : "text-red-light dark:text-red-dark"
              }
            >
              {myElo.after}
            </span>{" "}
            <span className="text-sm font-bold">
              ({myElo.after - myElo.before >= 0 ? "+" : ""}
              {myElo.after - myElo.before})
            </span>
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <Link href="/duel">
          <Button>Play Again</Button>
        </Link>
        <Link href="/">
          <Button variant="outline">Home</Button>
        </Link>
      </div>
    </div>
  );
}

function readStoredOpponent(
  gameCode: string,
): { name: string; profilePic: string | null } | null {
  try {
    const raw = sessionStorage.getItem(`duel:opponent:${gameCode}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
