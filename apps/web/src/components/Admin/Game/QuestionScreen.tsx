"use client";

import clsx from "clsx";
import Image from "next/image";
import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LuCheck, LuCopy, LuPlay, LuShare2 } from "react-icons/lu";
import { toast } from "react-toastify";
import { useAppSelector } from "@/state/hooks";
import { useServerCountdown } from "@/hooks/useServerCountdown";
import { buildJoinUrl } from "@/lib/join-link";
import {
  OptionKey,
  TimerRing,
  labelClass,
  mutedText,
  panelClass,
  primaryButtonClass,
  subtleCardClass,
} from "@/components/Game/GameUI";
import type { GameSocket } from "@/types/socket-events";

interface QuestionScreenProps {
  gameCode: string;
  socket: GameSocket;
}

/**
 * Renders the server-pushed question. The countdown is display-only — the
 * server ends the question at its own deadline; "Next" just asks the server
 * to skip ahead.
 */
export default function QuestionScreen(props: QuestionScreenProps) {
  const { gameCode, socket } = props;
  const question = useAppSelector((state) => state.game.question);
  const deadline = useAppSelector((state) => state.game.deadline);
  const qIndex = useAppSelector((state) => state.game.qIndex);
  const qCount = useAppSelector((state) => state.game.qCount);
  const answered = useAppSelector((state) => state.game.answeredCount);
  const players = useAppSelector((state) => state.game.players);
  const remaining = useServerCountdown(deadline);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  if (!question) return null;

  const options = question.options ?? [];
  const joinUrl = buildJoinUrl(gameCode);
  const total = Math.max(players.filter((p) => p.connected).length, answered);
  const answeredPct = total > 0 ? (answered / total) * 100 : 0;
  const left = qCount - (qIndex + 1);

  return (
    <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3.5 md:gap-5 md:pb-[18px]">
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
            <span className={labelClass}>Answers in</span>
            <span className={clsx("text-[13.5px]", mutedText)}>
              <b className="text-[22px] font-bold text-dark dark:text-white">
                {answered}
              </b>{" "}
              / {total}
            </span>
            <div className="h-2 rounded-lg overflow-hidden bg-lprimary/8 dark:bg-white/5">
              <div
                className="h-full rounded-lg bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] transition-[width] duration-300"
                style={{ width: `${answeredPct}%` }}
              />
            </div>
            <span className={clsx("text-[13px]", mutedText)}>
              {Math.max(0, total - answered)} still thinking
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className={labelClass}>Late joiners</span>
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
                    navigator.clipboard
                      .writeText(joinUrl)
                      .then(() => setCopied(true))
                      .catch(() => toast.error("Failed to copy link"))
                  }
                  className={clsx(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-xl border-[1.5px] bg-white dark:bg-dark px-3 py-2 text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-colors",
                    copied
                      ? "border-green-500 text-green-500"
                      : "border-lprimary/15 dark:border-white/5 hover:border-dprimary",
                  )}
                >
                  {copied ? <LuCheck size={15} /> : <LuCopy size={15} />}
                  {copied ? "Copied" : "Copy link"}
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
                    Share
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className={clsx(
          panelClass,
          "flex flex-col p-5 md:px-[34px] md:py-8 md:min-h-0 md:overflow-y-auto",
        )}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[12.5px] font-bold tracking-[0.06em] uppercase rounded-full px-3 py-1.5 text-lprimary dark:text-dprimary bg-lprimary/8 dark:bg-white/5">
            Question {qIndex + 1} of {qCount}
          </span>
          <span className={clsx("text-[13px]", mutedText)}>
            {question.timeOut}s to answer
          </span>
        </div>
        {question.mediaType === "image" && question.media && (
          <Image
            src={question.media}
            className="mt-5 mx-auto max-h-[26dvh] w-auto rounded-2xl"
            alt="Question image"
            height={300}
            width={500}
          />
        )}
        <h2 className="mt-[18px] text-2xl md:text-[34px] font-bold tracking-[-0.02em] leading-[1.22] text-pretty wrap-break-word">
          {question.title}
        </h2>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 md:auto-rows-[minmax(0,1fr)] gap-3.5 mt-7 min-h-0">
          {options.map((opt, index) => (
            <div
              key={opt.id}
              className={clsx(
                "flex items-center gap-4 rounded-[18px] border-[1.5px] px-4 py-3.5 md:px-[22px] md:py-[18px] min-h-16 md:min-h-[84px] text-[17px] md:text-xl font-semibold wrap-break-word min-w-0",
                subtleCardClass,
              )}
            >
              <OptionKey index={index} className="size-10 md:size-11 text-lg" />
              <span className="min-w-0">{opt.title}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3.5 mt-[22px] pt-5 border-t border-lprimary/15 dark:border-white/10">
          <p
            className={clsx(
              "basis-full md:basis-auto flex-1 text-sm",
              mutedText,
            )}
          >
            {left > 0
              ? `${left} question${left === 1 ? "" : "s"} left after this one`
              : "This is the last question"}
          </p>
          <button
            type="button"
            onClick={() => socket.emit("host-next")}
            className={clsx(primaryButtonClass, "flex-1 md:flex-none")}
          >
            Next
            <LuPlay size={17} className="fill-current" />
          </button>
        </div>
      </section>
    </div>
  );
}
