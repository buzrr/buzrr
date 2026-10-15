"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DailyStreak } from "@buzrr/contract";
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
import { Question, Result } from "@/components/Player/GameScreens";
import GetReady from "@/components/Game/GetReady";
import ReportQuestionButton from "./ReportQuestionButton";
import DuelAudio, { type DuelOutcome } from "./DuelAudio";
import { FlameIcon, TrophyIcon } from "./duelUi";
import { readMatched, type StoredMatch } from "./matchedStorage";

export default function DuelGameClient({ gameCode }: { gameCode: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const { data: profile } = useDuelProfileQuery();
  const queryClient = useQueryClient();
  // Only read once the client renders: until the token arrives the page shows
  // GetReady, so this never differs from the server-rendered markup.
  const [matched] = useState<StoredMatch | null>(() =>
    typeof window === "undefined" ? null : readMatched(gameCode),
  );

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
  const gameOver = useAppSelector((state) => state.game.gameOver);

  // Ratings, records and the streak all moved: refetch the duel profile.
  useEffect(() => {
    if (gameOver) void queryClient.invalidateQueries({ queryKey: ["duel"] });
  }, [gameOver, queryClient]);

  const title = matched?.category
    ? `1v1 Duel · ${matched.category.name}`
    : "1v1 Duel";

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

  if (!token || !socket) return <GetReady title="1v1 Duel" />;

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
              quizTitle={title}
              gameCode={gameCode}
              hideRoomCode
            />
          </>
        ) : (
          <GetReady title="1v1 Duel" />
        )
      ) : phase === "reveal" ? (
        <Result you={you} gameCode={gameCode} quizTitle={title} hideRoomCode />
      ) : phase === "final" || phase === "ended" ? (
        <DuelResultScreen myId={profile?.id} />
      ) : (
        <DuelStartingScreen
          myId={profile?.id}
          matched={matched}
          streak={profile?.streak}
        />
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
    <div className="flex items-center justify-center gap-4 py-2 md:py-3 px-4">
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
  myId,
  matched,
  streak,
}: {
  myId?: string;
  matched: StoredMatch | null;
  streak?: DailyStreak;
}) {
  const players = useAppSelector((state) => state.game.players);
  const qCount = useAppSelector((state) => state.game.qCount);
  const deadline = useAppSelector((state) => state.game.deadline);
  const remaining = Math.ceil(useServerCountdown(deadline));

  const opponent = players.find((p) => p.id !== myId) ?? matched?.opponent;
  const questionCount = qCount || matched?.questionCount;
  const categoryName = matched?.category?.name ?? "Random";

  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-3.5 px-4">
      <p className="text-center text-[28px] font-extrabold tracking-tight text-dark dark:text-white sm:text-[38px] animate-fade-up">
        {opponent ? `You vs ${opponent.name}` : "Get ready!"}
      </p>
      <span className="rounded-full bg-card-light dark:bg-card-dark px-3 py-1.5 text-[13.5px] font-bold text-lprimary dark:text-dprimary">
        {categoryName}
        {questionCount ? ` · ${questionCount} questions` : ""}
      </span>
      <p
        key={remaining}
        className="text-8xl font-extrabold leading-none text-lprimary dark:text-dprimary sm:text-[120px] animate-pop-in"
      >
        {remaining > 0 ? remaining : "GO!"}
      </p>
      {streak && (
        <span className="inline-flex items-center gap-1 rounded-full bg-flame/12 py-1 pl-[7px] pr-2.5 text-[13px] font-extrabold text-flame">
          <FlameIcon size={14} />
          {streak.playedToday
            ? `${streak.current}-day streak · today already counted`
            : streak.current > 0
              ? `${streak.current}-day streak · today counts`
              : "Finish this duel to start a streak"}
        </span>
      )}
    </div>
  );
}

const positive = "text-green-600 dark:text-green-400";
const negative = "text-red-light dark:text-red-dark";

function DuelResultScreen({ myId }: { myId?: string }) {
  const leaderboard = useAppSelector((state) => state.game.leaderboard);
  const eloChanges = useAppSelector((state) => state.game.eloChanges);
  const rated = useAppSelector((state) => state.game.rated);
  const category = useAppSelector((state) => state.game.category);
  const streaks = useAppSelector((state) => state.game.streaks);

  const me = leaderboard.find((e) => e.playerId === myId);
  const opponent = leaderboard.find((e) => e.playerId !== myId);
  const myElo = myId ? eloChanges?.[myId] : undefined;
  const myStreak = myId ? streaks?.[myId] : undefined;

  const won = Boolean(me && opponent && me.score > opponent.score);
  const outcome =
    !me || !opponent
      ? "Duel over"
      : me.score === opponent.score
        ? "It's a tie!"
        : won
          ? "You won!"
          : "You lost";
  const categoryName = category?.name ?? "Random";
  const categoryQuery = category
    ? `category=${encodeURIComponent(category.id)}`
    : "";
  const delta = myElo ? myElo.after - myElo.before : 0;

  return (
    <div className="flex min-h-[80dvh] flex-col items-center justify-center gap-5 px-5 py-8 sm:gap-[22px]">
      {won && <ConfettiBurst />}
      {won && (
        <div className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[#d99a12]/18 text-[#d99a12] animate-pop-in">
          <TrophyIcon size={38} />
        </div>
      )}
      <p className="text-center text-[38px] font-extrabold tracking-tight text-dark dark:text-white sm:text-[52px] animate-pop-in">
        {outcome}
      </p>

      <div className="flex items-center gap-9 sm:gap-14 animate-fade-up [animation-delay:150ms]">
        {[me, opponent].filter(Boolean).map((entry) => (
          <div
            key={entry!.playerId}
            className="flex flex-col items-center gap-1.5"
          >
            <Image
              src={entry!.profilePic || DEFAULT_AVATAR}
              width={104}
              height={104}
              alt={entry!.name}
              className="h-[84px] w-[84px] rounded-full sm:h-[104px] sm:w-[104px]"
            />
            <p className="text-[17px] font-bold text-dark dark:text-white">
              {entry!.playerId === myId ? "You" : entry!.name}
            </p>
            <p className="text-2xl font-extrabold text-lprimary dark:text-dprimary sm:text-[30px]">
              {entry!.score}
            </p>
          </div>
        ))}
      </div>

      <div className="grid w-full max-w-[520px] grid-cols-2 rounded-[22px] border border-lprimary/15 dark:border-white/5 bg-white dark:bg-dark shadow-[0_10px_30px_-18px_rgba(70,40,160,0.35)] animate-fade-up [animation-delay:300ms]">
        <SummaryCell label={category ? `${categoryName} rating` : "Rating"}>
          {rated && myElo ? (
            <>
              <span className="flex items-center gap-2 text-[21px] font-extrabold text-dark dark:text-white sm:text-[26px]">
                {myElo.before}
                <span className="font-medium text-[#8a8896]">→</span>
                <span className={delta >= 0 ? positive : negative}>
                  {myElo.after}
                </span>
              </span>
              <span
                className={`text-[13px] font-bold ${delta >= 0 ? positive : negative}`}
              >
                {delta >= 0 ? "+" : ""}
                {delta}
              </span>
            </>
          ) : (
            <SummaryEmpty
              note={
                rated ? "Rating unchanged" : "Friendly duel — rating unaffected"
              }
            />
          )}
        </SummaryCell>
        <SummaryCell label="Daily streak" divided>
          {myStreak ? (
            <>
              <span className="flex items-center gap-1.5 text-[21px] font-extrabold text-flame sm:text-[26px]">
                <FlameIcon size={24} />
                {myStreak.current} day{myStreak.current === 1 ? "" : "s"}
              </span>
              <span className="text-[13px] text-off-dark dark:text-muted-dark">
                {myStreak.advanced
                  ? "Today's duel counted"
                  : "Already counted today"}{" "}
                · best {myStreak.best}
              </span>
            </>
          ) : (
            <SummaryEmpty note="Unfinished duels don't count" />
          )}
        </SummaryCell>
      </div>

      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center">
        <Link href={`/duel?${categoryQuery ? `${categoryQuery}&` : ""}auto=1`}>
          <Button fullWidth>Play Again · {categoryName}</Button>
        </Link>
        <Link href={categoryQuery ? `/duel?${categoryQuery}` : "/duel"}>
          <Button variant="outline" fullWidth>
            Change category
          </Button>
        </Link>
        <Link href="/">
          <Button variant="outline" fullWidth>
            Home
          </Button>
        </Link>
      </div>
    </div>
  );
}

function SummaryCell({
  label,
  divided = false,
  children,
}: {
  label: string;
  divided?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1 px-2.5 py-3.5 text-center sm:px-[22px] sm:py-[18px] ${
        divided ? "border-l border-lprimary/15 dark:border-white/5" : ""
      }`}
    >
      <span className="text-[13.5px] text-off-dark dark:text-muted-dark">
        {label}
      </span>
      {children}
    </div>
  );
}

function SummaryEmpty({ note }: { note: string }) {
  return (
    <>
      <span className="text-[21px] font-extrabold text-dark dark:text-white sm:text-[26px]">
        –
      </span>
      <span className="text-[13px] text-off-dark dark:text-muted-dark">
        {note}
      </span>
    </>
  );
}
