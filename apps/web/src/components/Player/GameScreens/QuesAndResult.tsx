"use client";
import clsx from "clsx";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  LuArrowDown,
  LuArrowUp,
  LuCheck,
  LuClock,
  LuSend,
  LuTrophy,
  LuX,
} from "react-icons/lu";
import {
  isScoredType,
  type PublicQuestion,
  type QuestionAnswer,
} from "@buzrr/contract";
import { scoresStepPending } from "@/lib/moderation";
import { DEFAULT_AVATAR } from "@/constants";
import { useAppSelector } from "@/state/hooks";
import type { Standing } from "@/state/game/gameSlice";
import { useServerCountdown } from "@/hooks/useServerCountdown";
import { AnswerInput, QuestionTypePill } from "@/components/QuestionTypes";
import {
  GameTopBar,
  StatTile,
  TimerBar,
  TimerRing,
  WaitingDots,
  mutedText,
  ordinal,
  panelClass,
  subtleCardClass,
} from "@/components/Game/GameUI";

const STATUS = {
  correct: {
    heading: "Correct!",
    icon: <LuCheck size={56} strokeWidth={3} />,
    circle:
      "bg-green-500 shadow-[0_0_0_8px_rgba(34,197,94,0.14),0_0_0_16px_rgba(34,197,94,0.06)] md:shadow-[0_0_0_14px_rgba(34,197,94,0.14),0_0_0_30px_rgba(34,197,94,0.06)]",
    accent: "text-green-600 dark:text-green-500",
    answer: "border-green-500 bg-green-500/8",
  },
  incorrect: {
    heading: "Not quite",
    icon: <LuX size={56} strokeWidth={3} />,
    circle:
      "bg-[#e5544e] shadow-[0_0_0_8px_rgba(229,84,78,0.14),0_0_0_16px_rgba(229,84,78,0.06)] md:shadow-[0_0_0_14px_rgba(229,84,78,0.14),0_0_0_30px_rgba(229,84,78,0.06)]",
    accent: "text-[#e5544e]",
    answer: "border-[#e5544e] bg-[#e5544e]/8",
  },
  /** An unscored question (poll, word cloud, …): nothing to get right. */
  received: {
    heading: "Response received",
    icon: <LuSend size={48} strokeWidth={2.6} />,
    circle:
      "bg-lprimary dark:bg-dprimary shadow-[0_0_0_8px_rgba(124,77,219,0.14),0_0_0_16px_rgba(124,77,219,0.06)] md:shadow-[0_0_0_14px_rgba(124,77,219,0.14),0_0_0_30px_rgba(124,77,219,0.06)]",
    accent: "text-lprimary dark:text-dprimary",
    answer: "border-lprimary/40 dark:border-dprimary/40 bg-lprimary/8",
  },
  timesout: {
    heading: "Time's up!",
    icon: <LuClock size={52} strokeWidth={2.6} />,
    circle:
      "bg-[#e0a020] shadow-[0_0_0_8px_rgba(224,160,32,0.14),0_0_0_16px_rgba(224,160,32,0.06)] md:shadow-[0_0_0_14px_rgba(224,160,32,0.14),0_0_0_30px_rgba(224,160,32,0.06)]",
    accent: "text-[#c98a0e] dark:text-[#e0a020]",
    answer: "border-[#e0a020] bg-[#e0a020]/8",
  },
} as const;

/** Places climbed (positive) or dropped since the reveal before. */
function rankMove(standing: Standing): number {
  return standing.previousRank === null
    ? 0
    : standing.previousRank - standing.rank;
}

/** "▲ 2" / "▼ 1" beside a rank; nothing when it didn't change. */
function RankMove({ move }: { move: number }) {
  if (move === 0) return null;
  const up = move > 0;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-0.5 font-bold",
        up ? "text-green-600 dark:text-green-500" : "text-[#e5544e]",
      )}
    >
      {up ? (
        <LuArrowUp size={14} strokeWidth={3} />
      ) : (
        <LuArrowDown size={14} strokeWidth={3} />
      )}
      <span className="sr-only">{up ? "up" : "down"}</span>
      {Math.abs(move)}
    </span>
  );
}

/** The player's place from the last reveal, in the top bar while answering. */
function StandingChip({ standing }: { standing: Standing }) {
  return (
    <span
      title="Your rank after the last question"
      className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-lprimary/15 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-[13px] font-semibold"
    >
      <LuTrophy
        size={14}
        className="text-lprimary dark:text-dprimary"
        aria-hidden="true"
      />
      <span className="sr-only">Your rank</span>
      {ordinal(standing.rank)}
    </span>
  );
}

/** Podium places in medal colours; everyone else in the brand colour. */
const PLACE_TEXT: Record<number, string> = {
  1: "text-[#c99a0e] dark:text-[#f4c542]",
  2: "text-[#7d8494] dark:text-[#b9bfcc]",
  3: "text-[#b8703c] dark:text-[#e0a173]",
};

/** A line of encouragement for where the player stands. */
function standingMessage(rank: number, playerCount: number): string {
  if (playerCount <= 1) return "Playing solo — every point counts!";
  if (rank === 1) return "You're in the lead — keep it up!";
  if (rank <= 3) return "Congrats, you're on the podium — keep it up!";
  const below = rank - 3;
  return below === 1
    ? "Just 1 place below the podium — you've got this!"
    : `${below} places below the podium — keep going!`;
}

/** The player's place after this question, under the answers. */
function StandingCard({
  standing,
  playerCount,
}: {
  standing: Standing;
  playerCount: number;
}) {
  const podium = standing.rank <= 3 && playerCount > 1;
  return (
    <div
      className={clsx(
        "mt-4 md:mt-6 w-full max-w-[420px] rounded-2xl px-5 py-4 md:py-5 flex flex-col items-center gap-1.5 animate-fade-up [animation-delay:250ms]",
        subtleCardClass,
      )}
    >
      <span
        className={clsx(
          "text-[12.5px] font-bold tracking-[0.06em] uppercase",
          mutedText,
        )}
      >
        Your standing
      </span>
      <p className="flex flex-wrap items-baseline justify-center gap-x-2 text-lg md:text-xl font-semibold">
        <span>You&apos;re in</span>
        <b
          className={clsx(
            "inline-flex items-center gap-1.5 text-[30px] md:text-[36px] font-extrabold tracking-[-0.02em] leading-none",
            PLACE_TEXT[standing.rank] ?? "text-lprimary dark:text-dprimary",
          )}
        >
          {podium && <LuTrophy size={24} aria-hidden="true" />}
          {ordinal(standing.rank)}
        </b>
        <span>
          place
          {playerCount > 1 && ` out of ${playerCount}`}
        </span>
        <RankMove move={rankMove(standing)} />
      </p>
      <p className="text-[15px] font-semibold">
        {standingMessage(standing.rank, playerCount)}
      </p>
      <p className={clsx("text-[13.5px]", mutedText)}>
        <b className="text-dark dark:text-white tabular-nums">
          {standing.totalScore.toLocaleString()}
        </b>{" "}
        points in total
      </p>
    </div>
  );
}

/** One labelled answer; `children` is the answer as its type renders it. */
function AnswerRow({
  label,
  children,
  className,
  emptyText,
}: {
  label: string;
  children?: ReactNode;
  className?: string;
  emptyText?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 md:gap-2 w-full">
      <span className="text-xs font-semibold tracking-[0.1em] uppercase text-[#8a8896] dark:text-muted-dark">
        {label}
      </span>
      <div
        className={clsx(
          "flex items-center gap-3.5 rounded-2xl border-[1.5px] px-4 py-2.5 md:px-[18px] md:py-3.5 text-base md:text-[17px] font-semibold text-left",
          className,
        )}
      >
        {children ? children : <span className={mutedText}>{emptyText}</span>}
      </div>
    </div>
  );
}

const QuestionAndResult = (params: {
  question?: PublicQuestion;
  quizTitle: string;
  gameCode: string;
  screen: "question" | "result";
  submitAnswer?: (answer: QuestionAnswer) => void;
  /** The answer sent (or being sent) for the open question. */
  answer?: QuestionAnswer | null;
  locked?: boolean;
  /** The question takes more answers: no "waiting" footer after one. */
  canAddMore?: boolean;
  status?: keyof typeof STATUS;
  /** Points earned this question (result screen). */
  points?: number;
  /** The player's answer, rendered by its question type (result screen). */
  yourAnswer?: ReactNode | null;
  /** The right answer(s), rendered by the question type (result screen). */
  correctAnswers?: ReactNode[];
  /** Hide the "Room code" line (e.g. 1v1 duels, where the code is internal). */
  hideRoomCode?: boolean;
  /** Host of the quiz — shown as "Quiz by". Omitted for duels (no host). */
  hostName?: string | null;
  hostImage?: string | null;
}) => {
  const deadline = useAppSelector((state) => state.game.deadline);
  const connection = useAppSelector((state) => state.game.connection);
  const qIndex = useAppSelector((state) => state.game.qIndex);
  const qCount = useAppSelector((state) => state.game.qCount);
  const players = useAppSelector((state) => state.game.players);
  const you = useAppSelector((state) => state.game.you);
  // Duels show both scores in their own header instead.
  const standing = useAppSelector((state) =>
    state.game.mode === "classic" ? state.game.standing : null,
  );
  // Moderated: a player learns their new place with the host's scores step
  // (or the final standings), not with the answer.
  const moderation = useAppSelector((state) => state.game.moderation);
  const liveQuestion = useAppSelector((state) => state.game.question);
  const placeLater =
    moderation !== null &&
    (liveQuestion ? isScoredType(liveQuestion.type) : true) &&
    (qIndex >= qCount - 1 || scoresStepPending(moderation));
  // Answers submitted while offline would be rejected anyway — lock the UI.
  const offline = connection !== "connected";
  // Display-only countdown against the server deadline; the reveal is pushed
  // by the server regardless of what this shows.
  const remaining = useServerCountdown(deadline);
  const timeOut = params?.question?.timeOut ?? 1;
  const isQuestion = params.screen === "question";
  const status = STATUS[params.status ?? "timesout"];
  const isLast = qCount > 0 && qIndex >= qCount - 1;
  // The player page scrolls as a whole, so size the title by length rather
  // than overflow: a long title, or long options below it, gets a smaller one.
  const longTitle =
    (params.question?.title.length ?? 0) > 120 ||
    (params.question !== undefined &&
      "options" in params.question &&
      params.question.options.some((o) => o.title.length > 80));

  function handleSubmit(answer: QuestionAnswer) {
    if (params.locked || offline) return;
    params?.submitAnswer?.(answer);
  }

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col px-4 sm:px-6 lg:px-8 pb-16 md:pb-6 md:min-h-[calc(100dvh-7.5rem)] text-dark dark:text-white">
      <GameTopBar
        title={params.quizTitle}
        qIndex={qIndex}
        qCount={qCount}
        right={
          isQuestion && standing ? (
            <StandingChip standing={standing} />
          ) : undefined
        }
      />
      {isQuestion && (
        <TimerBar
          key={params.question?.id ?? params.question?.title}
          value={remaining}
          max={timeOut}
          className="mb-2.5 md:hidden"
        />
      )}
      <div className="flex-1 flex flex-col md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3.5 md:gap-5">
        <section
          className={clsx(
            panelClass,
            "hidden md:flex flex-col justify-center gap-6 p-[30px]",
          )}
        >
          <div className="flex items-center gap-[26px]">
            {isQuestion ? (
              <TimerRing
                key={params.question?.id ?? params.question?.title}
                value={Math.ceil(remaining)}
                max={timeOut}
                label="seconds"
                className="size-[150px]"
                valueClassName="text-5xl"
              />
            ) : (
              <TimerRing
                value={0}
                max={1}
                label="time's up"
                className="size-[150px]"
                valueClassName="text-5xl"
              />
            )}
            <div className="flex flex-col gap-2.5 min-w-0">
              <h2 className="text-xl md:text-[30px] font-bold tracking-[-0.02em] truncate capitalize">
                {params.quizTitle}
              </h2>
              {!params.hideRoomCode && (
                <span
                  className={clsx(
                    "text-[13px] md:text-sm whitespace-nowrap",
                    mutedText,
                  )}
                >
                  Room code{" "}
                  <b className="tracking-[0.08em] text-dark dark:text-white">
                    {params.gameCode}
                  </b>
                </span>
              )}
              {qCount > 0 && (
                <span
                  className={clsx(
                    "text-[13px] md:text-sm whitespace-nowrap",
                    mutedText,
                  )}
                >
                  Question {qIndex + 1} of {qCount}
                </span>
              )}
            </div>
          </div>
          {params.hostName && (
            <div
              className={clsx(
                "hidden md:flex items-center gap-3 rounded-2xl px-4 py-3.5",
                subtleCardClass,
              )}
            >
              <Image
                src={params.hostImage || DEFAULT_AVATAR}
                width={42}
                height={42}
                alt=""
                className="size-[42px] rounded-full object-cover"
              />
              <div className={clsx("flex flex-col text-[12.5px]", mutedText)}>
                Quiz by
                <b className="text-[15px] font-semibold text-dark dark:text-white">
                  {params.hostName}
                </b>
              </div>
            </div>
          )}
          {!isQuestion && you && !placeLater && (
            <div className="hidden md:grid grid-cols-2 gap-3">
              <StatTile
                value={you.rank ? ordinal(you.rank) : "—"}
                suffix={players.length > 0 ? ` /${players.length}` : undefined}
                label="Your rank"
              />
              <StatTile
                value={you.totalScore.toLocaleString()}
                label="Total points"
              />
            </div>
          )}
        </section>

        {isQuestion ? (
          <section
            className={clsx(
              panelClass,
              "flex flex-col p-4 md:px-[34px] md:py-8",
            )}
          >
            {params.question?.mediaType === "image" &&
              params.question.media && (
                <Image
                  src={params.question.media}
                  className="mb-4 md:mb-5 mx-auto max-h-[28dvh] w-auto rounded-2xl"
                  alt="Question image"
                  height={320}
                  width={500}
                />
              )}
            <div
              className={clsx(
                "flex flex-wrap items-center gap-2",
                params.question?.type !== "multiple_choice" && "mb-3 md:mb-0",
              )}
            >
              {params.question &&
                params.question.type !== "multiple_choice" && (
                  <QuestionTypePill type={params.question.type} />
                )}
              <span className="hidden md:inline-block w-fit text-[12.5px] font-bold tracking-[0.06em] uppercase rounded-full px-3 py-1.5 text-lprimary dark:text-dprimary bg-lprimary/8 dark:bg-white/5">
                Question {qIndex + 1}
                {qCount > 0 && ` of ${qCount}`}
              </span>
            </div>
            <h2
              className={clsx(
                "md:mt-[18px] font-bold tracking-[-0.02em] leading-[1.22] text-pretty wrap-break-word animate-fade-up",
                longTitle
                  ? "text-lg md:text-[26px]"
                  : "text-[22px] md:text-[34px]",
              )}
            >
              {params.question?.title ?? ""}
            </h2>
            {params.question && (
              <AnswerInput
                question={params.question}
                selected={params.answer ?? null}
                disabled={offline || Boolean(params.locked)}
                onSubmit={handleSubmit}
              />
            )}
            {params.locked && !params.canAddMore && (
              <div className="mt-6 flex justify-center animate-fade-up">
                <WaitingDots>
                  Answer received — waiting for the results
                </WaitingDots>
              </div>
            )}
          </section>
        ) : (
          <section
            className={clsx(
              panelClass,
              "flex flex-col items-center justify-center text-center gap-1.5 md:gap-2.5 px-5 pt-7 pb-5 md:p-10",
            )}
          >
            <div
              className={clsx(
                "size-16 md:size-[120px] rounded-full text-white flex items-center justify-center mb-5 md:mb-[22px] animate-pop-in [&_svg]:size-8 md:[&_svg]:size-auto",
                status.circle,
                params.status === "incorrect" && "animate-shake",
              )}
            >
              {status.icon}
            </div>
            <h2 className="text-[26px] md:text-[40px] font-extrabold tracking-[-0.02em]">
              {status.heading}
            </h2>
            {/* Moderated with standings to come: the points come with them
                (the scores step's own row, or the final standings). */}
            {!(
              placeLater &&
              (params.status === "correct" || params.status === "incorrect")
            ) && (
              <span
                className={clsx(
                  "text-lg md:text-[26px] font-bold animate-fade-up",
                  status.accent,
                )}
              >
                {params.status === "timesout"
                  ? "No answer this round"
                  : params.status === "received"
                    ? "Not scored — thanks for answering"
                    : `+${params.points ?? 0} points`}
              </span>
            )}
            <div className="mt-3 md:mt-[22px] flex flex-col gap-3 md:gap-4 w-full max-w-[420px] animate-fade-up [animation-delay:150ms]">
              <AnswerRow
                label="Your answer"
                className={status.answer}
                emptyText="You didn't answer in time"
              >
                {params.yourAnswer}
              </AnswerRow>
              {params.status !== "correct" &&
                params.status !== "received" &&
                params.correctAnswers?.map((node, i) => (
                  <AnswerRow
                    key={i}
                    label="Correct answer"
                    className={STATUS.correct.answer}
                  >
                    {node}
                  </AnswerRow>
                ))}
            </div>
            {standing && standing.qIndex === qIndex && !placeLater && (
              <StandingCard standing={standing} playerCount={players.length} />
            )}
            <div className="mt-4 md:mt-[26px]">
              <WaitingDots>
                {params.hideRoomCode
                  ? isLast
                    ? "Final results coming up"
                    : "Next question coming up"
                  : isLast
                    ? "Waiting for the final results"
                    : `Waiting for the host to start question ${qIndex + 2}`}
              </WaitingDots>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default QuestionAndResult;
