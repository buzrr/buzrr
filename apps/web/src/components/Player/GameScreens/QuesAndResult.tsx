"use client";
import clsx from "clsx";
import Image from "next/image";
import type { ReactNode } from "react";
import { LuCheck, LuClock, LuX } from "react-icons/lu";
import type { PublicQuestion, QuestionAnswer } from "@buzrr/contract";
import { DEFAULT_AVATAR } from "@/constants";
import { useAppSelector } from "@/state/hooks";
import { useServerCountdown } from "@/hooks/useServerCountdown";
import { AnswerInput } from "@/components/QuestionTypes";
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
  timesout: {
    heading: "Time's up!",
    icon: <LuClock size={52} strokeWidth={2.6} />,
    circle:
      "bg-[#e0a020] shadow-[0_0_0_8px_rgba(224,160,32,0.14),0_0_0_16px_rgba(224,160,32,0.06)] md:shadow-[0_0_0_14px_rgba(224,160,32,0.14),0_0_0_30px_rgba(224,160,32,0.06)]",
    accent: "text-[#c98a0e] dark:text-[#e0a020]",
    answer: "border-[#e0a020] bg-[#e0a020]/8",
  },
} as const;

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
      <span className="text-xs font-semibold tracking-[0.1em] uppercase text-[#8a8896] dark:text-[#71717a]">
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
  // Answers submitted while offline would be rejected anyway — lock the UI.
  const offline = connection !== "connected";
  // Display-only countdown against the server deadline; the reveal is pushed
  // by the server regardless of what this shows.
  const remaining = useServerCountdown(deadline);
  const timeOut = params?.question?.timeOut ?? 1;
  const isQuestion = params.screen === "question";
  const status = STATUS[params.status ?? "timesout"];
  const isLast = qCount > 0 && qIndex >= qCount - 1;

  function handleSubmit(answer: QuestionAnswer) {
    if (params.locked || offline) return;
    params?.submitAnswer?.(answer);
  }

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col px-4 sm:px-6 lg:px-8 pb-16 md:pb-6 md:min-h-[calc(100dvh-7.5rem)] text-dark dark:text-white">
      <GameTopBar title={params.quizTitle} qIndex={qIndex} qCount={qCount} />
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
          {!isQuestion && you && (
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
            <span className="hidden md:inline-block w-fit text-[12.5px] font-bold tracking-[0.06em] uppercase rounded-full px-3 py-1.5 text-lprimary dark:text-dprimary bg-lprimary/8 dark:bg-white/5">
              Question {qIndex + 1}
              {qCount > 0 && ` of ${qCount}`}
            </span>
            <h2 className="md:mt-[18px] text-[22px] md:text-[34px] font-bold tracking-[-0.02em] leading-[1.22] text-pretty wrap-break-word animate-fade-up">
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
            {params.locked && (
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
            <span
              className={clsx(
                "text-lg md:text-[26px] font-bold animate-fade-up",
                status.accent,
              )}
            >
              {params.status === "timesout"
                ? "No answer this round"
                : `+${params.points ?? 0} points`}
            </span>
            <div className="mt-3 md:mt-[22px] flex flex-col gap-3 md:gap-4 w-full max-w-[420px] animate-fade-up [animation-delay:150ms]">
              <AnswerRow
                label="Your answer"
                className={status.answer}
                emptyText="You didn't answer in time"
              >
                {params.yourAnswer}
              </AnswerRow>
              {params.status !== "correct" &&
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
