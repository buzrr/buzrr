"use client";

import clsx from "clsx";
import Image from "next/image";
import { DEFAULT_AVATAR } from "@/constants";
import {
  OPTION_COLORS,
  OptionKey,
  WaitingDots,
  mutedText,
  subtleCardClass,
} from "@/components/Game/GameUI";
import { AnimatedNumber, useEntered } from "@/components/Game/motion";
import { useT, pl } from "@/lib/i18n/context";
import { Tooltip } from "@/components/ui/Tooltip";

// The results views of the unscored types. The host sees them filling in
// live while the question is open, and again, final, at the reveal.

const pct = (n: number, of: number) =>
  of > 0 ? Math.round((n / of) * 100) : 0;

export function NoResponsesYet() {
  const t = useT();
  return (
    <div className="flex-1 flex items-center justify-center py-10">
      <WaitingDots>{t("Waiting for the first responses")}</WaitingDots>
    </div>
  );
}

/** One bar per option, filled relative to the most-voted one. */
export function PollBars({
  options,
  counts,
  responses,
}: {
  options: { id: string; title: string }[];
  counts: number[];
  responses: number;
}) {
  const entered = useEntered();
  const max = Math.max(1, ...counts);
  return (
    <div className="flex-1 flex flex-col justify-center gap-2.5 md:gap-3.5 mt-5 md:mt-7">
      {options.map((option, i) => {
        const count = counts[i] ?? 0;
        const share = pct(count, responses);
        return (
          <div
            key={option.id}
            className="grid grid-cols-[34px_minmax(0,1fr)_46px] md:grid-cols-[46px_minmax(0,1fr)_70px] items-center gap-2.5 md:gap-4"
          >
            <OptionKey
              index={i}
              className="size-[34px] md:size-[46px] text-sm md:text-base rounded-[9px] md:rounded-xl"
            />
            <div className="relative h-[46px] md:h-[58px] rounded-[14px] overflow-hidden flex items-center bg-lprimary/8 dark:bg-white/5">
              <span
                className="absolute inset-y-0 left-0 rounded-[14px] transition-[width] duration-700 ease-out motion-reduce:transition-none"
                style={{
                  width: `${entered ? (count / max) * 100 : 0}%`,
                  background: OPTION_COLORS[i % OPTION_COLORS.length],
                  opacity: count === max && count > 0 ? 0.34 : 0.2,
                }}
              />
              <div className="relative w-full flex items-center justify-between gap-3 px-3 md:px-5 text-[15px] md:text-[19px] font-bold min-w-0">
                <Tooltip
                  content={option.title}
                  onlyWhenTruncated
                  className="min-w-0 truncate"
                >
                  {option.title}
                </Tooltip>
                <span
                  className={clsx(
                    "hidden md:inline shrink-0 text-[15px] font-semibold",
                    mutedText,
                  )}
                >
                  {count} {count === 1 ? "vote" : "votes"}
                </span>
              </div>
            </div>
            <span className="text-base md:text-[22px] font-extrabold text-right tabular-nums">
              <AnimatedNumber
                value={share}
                duration={500}
                format={(v) => String(Math.round(v))}
              />
              %
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** A stable pseudo-random order, so the cloud doesn't reshuffle on update. */
function hash(word: string) {
  let h = 0;
  for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) | 0;
  return h;
}

/** Words sized by how often they came up. */
export function WordCloudView({
  words,
}: {
  words: { word: string; count: number }[];
}) {
  if (words.length === 0) return <NoResponsesYet />;
  const max = Math.max(...words.map((w) => w.count));
  const min = Math.min(...words.map((w) => w.count));
  const ordered = [...words].sort((a, b) => hash(a.word) - hash(b.word));
  return (
    <div className="flex-1 flex flex-wrap items-center justify-center content-center gap-x-3 md:gap-x-[22px] gap-y-0.5 md:gap-y-1.5 py-4 md:px-[30px] leading-[1.05] [--cloud:0.55] md:[--cloud:1]">
      {ordered.map(({ word, count }) => {
        const weight = max === min ? 0.5 : (count - min) / (max - min);
        return (
          <Tooltip
            key={word}
            content={`${count} ${count === 1 ? "answer" : "answers"}`}
          >
            <span
              className="font-extrabold tracking-[-0.02em] break-all animate-pop-in"
              style={{
                fontSize: `calc(var(--cloud) * ${Math.round(18 + weight * 46)}px)`,
                color: OPTION_COLORS[Math.abs(hash(word)) % 4],
              }}
            >
              {word}
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ opacity: filled ? 1 : 0.25 }}
    >
      <path
        d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** The average, as stars, plus how the ratings spread across the scale. */
export function RatingView({
  counts,
  responses,
}: {
  counts: number[];
  responses: number;
}) {
  const t = useT();
  const entered = useEntered();
  if (responses === 0) return <NoResponsesYet />;
  const total = counts.reduce((sum, c, i) => sum + c * (i + 1), 0);
  const average = total / responses;
  const max = Math.max(1, ...counts);
  const scaleMax = counts.length;
  const stars = Math.round((average / scaleMax) * 5);
  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-6 md:gap-[50px] items-center mt-5 md:mt-7">
      <div className="flex flex-col items-center gap-1.5">
        <b className="text-[64px] md:text-[88px] font-extrabold leading-none tracking-[-0.04em] tabular-nums">
          <AnimatedNumber
            value={average}
            duration={500}
            format={(v) => v.toFixed(1)}
          />
        </b>
        <div className="flex gap-1 text-[#e0a020]">
          {[1, 2, 3, 4, 5].map((k) => (
            <Star key={k} filled={k <= stars} size={22} />
          ))}
        </div>
        <span className={clsx("text-sm", mutedText)}>
          {t(pl(responses, "average of {n} rating", "average of {n} ratings"), {
            n: responses,
          })}
          {scaleMax === 10 ? ` · ${t("out of 10")}` : ""}
        </span>
      </div>
      <div className="flex items-end gap-2.5 md:gap-4 h-40 md:h-60">
        {counts.map((count, i) => (
          <div
            key={i}
            className="flex-1 h-full flex flex-col items-center justify-end gap-2"
          >
            <span className="text-[15px] font-extrabold tabular-nums">
              {count}
            </span>
            <i
              className="block w-full rounded-[12px_12px_4px_4px] bg-lprimary dark:bg-dprimary transition-[height] duration-700 ease-out motion-reduce:transition-none"
              style={{
                height: `${entered ? Math.max(2, (count / max) * 78) : 0}%`,
                opacity: 0.45 + (i / Math.max(1, scaleMax - 1)) * 0.55,
              }}
            />
            <span className={clsx("text-sm font-semibold", mutedText)}>
              {i + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Free-text answers as a masonry wall, newest first. */
export function TextWall({
  entries,
}: {
  entries: { text: string; name: string | null; profilePic: string | null }[];
}) {
  if (entries.length === 0) return <NoResponsesYet />;
  return (
    <div className="flex-1 columns-1 md:columns-2 xl:columns-3 gap-3.5 mt-5 md:mt-7">
      {entries.map((entry, i) => (
        <div
          key={`${entries.length - i}`}
          className={clsx(
            "break-inside-avoid mb-3.5 rounded-2xl px-[18px] py-4 text-base font-medium leading-[1.45] wrap-break-word animate-fade-up",
            subtleCardClass,
          )}
        >
          {entry.text}
          <small
            className={clsx(
              "flex items-center gap-2 mt-2.5 text-[12.5px] font-semibold",
              mutedText,
            )}
          >
            {entry.name ? (
              <Image
                src={entry.profilePic || DEFAULT_AVATAR}
                width={20}
                height={20}
                alt=""
                className="size-5 rounded-full object-cover"
              />
            ) : (
              <span className="size-5 rounded-full bg-lprimary/8 dark:bg-white/10" />
            )}
            {entry.name ?? "Anonymous"}
          </small>
        </div>
      ))}
    </div>
  );
}
