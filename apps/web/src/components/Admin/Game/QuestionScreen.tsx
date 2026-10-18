"use client";

import QuestionPicture from "@/components/Game/QuestionPicture";
import clsx from "clsx";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LuCheck, LuCopy, LuShare2, LuSkipForward } from "react-icons/lu";
import { toast } from "react-toastify";
import { useAppSelector } from "@/state/hooks";
import { useAudioSegment } from "@/lib/audio-cues";
import { useGameSound } from "@/lib/sound/director";
import { useServerCountdown } from "@/hooks/useServerCountdown";
import { buildJoinUrl } from "@/lib/join-link";
import {
  HostPrompt,
  QuestionTypePill,
  isScoredType,
} from "@/components/QuestionTypes";
import {
  TimerRing,
  labelClass,
  mutedText,
  panelClass,
  dangerButtonClass,
  subtleCardClass,
} from "@/components/Game/GameUI";
import { useT } from "@/lib/i18n/context";
import type { GameSocket } from "@/types/socket";

interface QuestionScreenProps {
  gameCode: string;
  socket: GameSocket;
}

/**
 * Renders the server-pushed question. The countdown is display-only — the
 * server ends the question at its own deadline; "Next" just asks the server
 * to skip ahead.
 */
/** Seconds into a question before the host can skip it. */
const SKIP_AFTER_S = 15;

export default function QuestionScreen(props: QuestionScreenProps) {
  const t = useT();
  const { gameCode, socket } = props;
  const question = useAppSelector((state) => state.game.question);
  const deadline = useAppSelector((state) => state.game.deadline);
  const qIndex = useAppSelector((state) => state.game.qIndex);
  const qCount = useAppSelector((state) => state.game.qCount);
  const answered = useAppSelector((state) => state.game.answeredCount);
  const players = useAppSelector((state) => state.game.players);
  const live = useAppSelector((state) => state.game.liveSummary);
  // The question's sound: from its start cue, for the question's time —
  // if the quiz's sound settings put it on this screen.
  const sound = useGameSound();
  const audioHere = sound ? sound.questionAudioHere(question?.audio) : true;
  useAudioSegment(
    audioHere ? question?.audio?.url : null,
    question?.audio?.startMs,
    question ? question.timeOut * 1000 : null,
    question?.id,
    question?.audio?.key,
  );
  const remaining = useServerCountdown(deadline);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const promptRef = useRef<HTMLElement>(null);
  // Per-question: once the prompt panel overflows, drop to a smaller title so
  // less scrolling is needed. One-way so it can't flip back and forth.
  const [compact, setCompact] = useState<{ id: string; on: boolean }>();
  const questionId = question?.id;
  const isCompact = compact?.id === questionId && compact?.on;

  useLayoutEffect(() => {
    const el = promptRef.current;
    if (!el || !questionId || isCompact) return;
    const check = () => {
      if (el.scrollHeight > el.clientHeight + 1)
        setCompact({ id: questionId, on: true });
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
  }, [questionId, isCompact]);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  if (!question) return null;

  const joinUrl = buildJoinUrl(gameCode);
  const total = Math.max(players.filter((p) => p.connected).length, answered);
  const answeredPct = total > 0 ? (answered / total) * 100 : 0;
  const left = qCount - (qIndex + 1);
  const scored = isScoredType(question.type);

  const nobodyPlaying = !players.some((p) => p.connected);
  // Long (or unlimited) questions: after 15 s the host may cut them short.
  const elapsed = question.timeOut - remaining;
  const showSkip = nobodyPlaying || elapsed >= SKIP_AFTER_S;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3.5 md:gap-5">
        <section
          className={clsx(
            panelClass,
            "flex flex-col justify-center gap-6 md:gap-[30px] p-5 md:p-7 md:min-h-0 md:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          <div className="flex items-center gap-5 md:gap-6">
            <TimerRing
              key={question.id}
              value={Math.ceil(remaining)}
              max={question.timeOut}
              className="size-[120px] md:size-[180px]"
              valueClassName="text-4xl md:text-[58px]"
            />
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <span className={labelClass}>{t("Answers in")}</span>
              <span className={clsx("text-[13.5px]", mutedText)}>
                <b className="text-[22px] font-bold text-dark dark:text-white">
                  {answered}
                </b>{" "}
                / {total}
              </span>
              <div className="h-2 rounded-lg overflow-hidden bg-lprimary/8 dark:bg-white/5">
                <div
                  className="h-full rounded-lg bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] dark:from-accent dark:to-accent-deep transition-[width] duration-300"
                  style={{ width: `${answeredPct}%` }}
                />
              </div>
              <span className={clsx("text-[13px]", mutedText)}>
                {t("{n} still thinking", { n: Math.max(0, total - answered) })}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className={labelClass}>{t("Late joiners")}</span>
            <div
              className={clsx(
                "flex items-center gap-4 rounded-[18px] p-4",
                subtleCardClass,
              )}
            >
              <div className="size-[90px] md:size-[136px] shrink-0 rounded-[10px] bg-white p-1.5">
                <QRCodeSVG
                  value={joinUrl}
                  marginSize={0}
                  level="M"
                  className="size-full"
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <span className="text-[28px] font-extrabold tracking-[0.12em] leading-none text-lprimary dark:text-dprimary">
                  {gameCode}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      (
                        navigator.clipboard?.writeText(joinUrl) ??
                        Promise.reject(new Error(t("Clipboard unavailable")))
                      )
                        .then(() => setCopied(true))
                        .catch(() => toast.error(t("Failed to copy link")))
                    }
                    className={clsx(
                      "flex-1 flex items-center justify-center gap-1.5 rounded-xl border-[1.5px] bg-white dark:bg-dark px-3 py-2 text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-colors",
                      copied
                        ? "border-green-500 text-green-500"
                        : "border-lprimary/15 dark:border-white/5 hover:border-dprimary",
                    )}
                  >
                    {copied ? <LuCheck size={15} /> : <LuCopy size={15} />}
                    {copied ? "Copied" : t("Copy link")}
                  </button>
                  {canShare && (
                    <button
                      type="button"
                      onClick={() =>
                        navigator.share({ url: joinUrl }).catch(() => {})
                      }
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-[1.5px] bg-white dark:bg-dark border-lprimary/15 dark:border-white/5 hover:border-dprimary px-3 py-2 text-[13px] font-semibold cursor-pointer transition-colors"
                    >
                      <LuShare2 size={15} />
                      {t("Share")}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          ref={promptRef}
          className={clsx(
            panelClass,
            "flex flex-col p-5 md:px-[34px] md:py-8 md:min-h-0 md:overflow-y-auto",
          )}
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[12.5px] font-bold tracking-[0.06em] uppercase rounded-full px-3 py-1.5 text-lprimary dark:text-dprimary bg-lprimary/8 dark:bg-white/5">
              {t("Question {n} of {total}", { n: qIndex + 1, total: qCount })}
            </span>
            {question.type !== "multiple_choice" && (
              <QuestionTypePill type={question.type} />
            )}
            <span className={clsx("text-[13px]", mutedText)}>
              {scored
                ? `${question.timeOut}s to answer`
                : t("Not scored · results update live")}
            </span>
          </div>
          {question.mediaType === "image" && question.media && (
            <QuestionPicture
              media={question.media}
              mediaKey={question.mediaKey}
              className="mt-5 mx-auto max-h-[26dvh] w-auto rounded-2xl"
              alt={t("Question image")}
              height={300}
              width={500}
            />
          )}
          <h2
            className={clsx(
              "mt-[18px] font-bold tracking-[-0.02em] leading-[1.22] text-pretty wrap-break-word",
              isCompact ? "text-xl md:text-[26px]" : "text-2xl md:text-[34px]",
            )}
          >
            {question.title}
          </h2>
          <HostPrompt
            question={question}
            live={live?.index === qIndex ? live.summary : null}
          />
          <p className={clsx("mt-[22px] text-sm", mutedText)}>
            {left > 0
              ? `${left} question${left === 1 ? "" : "s"} left after this one`
              : t("This is the last question")}
          </p>
        </section>
      </div>
      {/* The host bar, like on every game screen: "Skip" on the far left
          (red; after 15 s, or right away with nobody playing), the regular
          next step always on the right — none while answers are open. */}
      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 py-3 min-h-[74px] bg-light-bg/90 dark:bg-dark-bg/90 backdrop-blur">
        {showSkip ? (
          <button
            type="button"
            data-host-key="skip"
            title={t('You can also press "Esc"')}
            onClick={() => socket.emit("host-next")}
            className={clsx(dangerButtonClass, "animate-fade-up")}
          >
            <LuSkipForward size={17} />
            {t("Skip")}
          </button>
        ) : (
          <span />
        )}
        <span className={clsx("text-sm", mutedText)}>
          {t("{n} of {total} answered", { n: answered, total })}
        </span>
      </div>
    </div>
  );
}
