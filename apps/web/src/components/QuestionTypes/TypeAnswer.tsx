"use client";

import clsx from "clsx";
import { useState, type ComponentProps } from "react";
import { LuCheck, LuKeyboard } from "react-icons/lu";
import {
  counterClass,
  inputClass,
  mutedText,
  subtleCardClass,
} from "@/components/Game/GameUI";
import { SubmitButton, useAnswerFocus } from "./Inputs";
import { CorrectGlow, ResultBar } from "./MultipleChoice";
import { useT } from "@/lib/i18n/context";
import type { QuestionRenderer } from "./types";

/** Splits typed characters (spaces ignored) into the pattern's words. */
function fillPattern(chars: string[], pattern: number[]): string[][] {
  let at = 0;
  return pattern.map((len) => {
    const word = chars.slice(at, at + len);
    at += len;
    return word;
  });
}

/**
 * Fixed length: one box per character, a gap between words. A transparent
 * input over the boxes takes the typing (and the phone's keyboard).
 */
function BoxesInput({
  pattern,
  value,
  disabled,
  onChange,
  onEnter,
}: {
  pattern: number[];
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onEnter: () => void;
}) {
  const t = useT();
  const inputRef = useAnswerFocus<HTMLInputElement>(disabled);
  const total = pattern.reduce((a, b) => a + b, 0);
  const chars = Array.from(value.replace(/\s+/g, "")).slice(0, total);
  const words = fillPattern(chars, pattern);
  const longest = Math.max(...pattern);
  return (
    <label className="relative mt-4 md:mt-7 block cursor-text">
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2.5">
        {words.map((word, w) => (
          <div key={w} className="flex gap-1">
            {Array.from({ length: pattern[w]! }, (_, i) => {
              const ch = word[i];
              const cursor =
                !disabled &&
                chars.length ===
                  pattern.slice(0, w).reduce((a, b) => a + b, 0) + i;
              return (
                <span
                  key={i}
                  className={clsx(
                    "flex items-center justify-center rounded-lg border-2 font-extrabold uppercase",
                    longest > 10
                      ? "size-7 text-base"
                      : "size-9 md:size-11 text-lg md:text-xl",
                    ch
                      ? "border-lprimary dark:border-dprimary bg-lprimary/8 dark:bg-dprimary/10"
                      : "border-lprimary/25 dark:border-white/15",
                    cursor && "ring-2 ring-dprimary/60",
                  )}
                >
                  {ch ?? ""}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type="text"
        autoFocus
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        enterKeyHint="send"
        aria-label={t("Type your answer")}
        value={chars.join("")}
        disabled={disabled}
        maxLength={total}
        onChange={(e) =>
          onChange(
            Array.from(e.target.value.replace(/\s+/g, ""))
              .slice(0, total)
              .join(""),
          )
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-text"
      />
    </label>
  );
}

function AnswerForm({
  question,
  selected,
  disabled,
  onSubmit,
}: ComponentProps<QuestionRenderer<"type_answer">["AnswerInput"]>) {
  const t = useT();
  const [text, setText] = useState("");
  const inputRef = useAnswerFocus<HTMLInputElement>(
    disabled || Boolean(selected),
  );
  if (selected) {
    return (
      <div
        className={clsx(
          "mt-4 md:mt-7 rounded-2xl px-4 py-3 text-lg font-bold wrap-break-word animate-fade-up",
          subtleCardClass,
        )}
      >
        <small className={clsx("block text-xs font-semibold", mutedText)}>
          {t("Your answer")}
        </small>
        {selected.guess}
      </div>
    );
  }
  const pattern = question.pattern;
  const send = () => {
    const guess = pattern
      ? fillPattern(Array.from(text), pattern)
          .map((w) => w.join(""))
          .filter(Boolean)
          .join(" ")
      : text.trim();
    if (guess && !disabled) onSubmit({ guess });
  };
  if (pattern) {
    const total = pattern.reduce((a, b) => a + b, 0);
    return (
      <>
        <BoxesInput
          pattern={pattern}
          value={text}
          disabled={disabled}
          onChange={setText}
          onEnter={send}
        />
        <div className="flex justify-center mt-2.5">
          <span className={counterClass}>
            {t("{n} / {total} letters", { n: Array.from(text).length, total })}
          </span>
        </div>
        <SubmitButton disabled={disabled || text === ""} onClick={send} />
      </>
    );
  }
  return (
    <>
      <input
        ref={inputRef}
        type="text"
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="send"
        className={clsx(inputClass, "mt-4 md:mt-7 text-lg font-semibold")}
        placeholder={t("Type your answer")}
        value={text}
        maxLength={question.maxLength}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            send();
          }
        }}
      />
      <div className="flex justify-end mt-2.5">
        <span className={counterClass}>
          {text.length} / {question.maxLength}
        </span>
      </div>
      <SubmitButton disabled={disabled || text.trim() === ""} onClick={send} />
    </>
  );
}

export const typeAnswerRenderer: QuestionRenderer<"type_answer"> = {
  AnswerInput(props) {
    return <AnswerForm {...props} />;
  },

  HostPrompt({ question }) {
    const t = useT();
    if (question.pattern) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-10">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
            {question.pattern.map((len, w) => (
              <div key={w} className="flex gap-1.5">
                {Array.from({ length: len }, (_, i) => (
                  <span
                    key={i}
                    className="size-10 md:size-14 rounded-lg border-2 border-lprimary/30 dark:border-white/20"
                  />
                ))}
              </div>
            ))}
          </div>
          <p className={clsx("text-lg font-semibold", mutedText)}>
            {t("{n} letters — fast and exact scores best", {
              n: question.pattern.reduce((a, b) => a + b, 0),
            })}
          </p>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10 text-center">
        <span className="size-16 rounded-2xl flex items-center justify-center bg-lprimary/10 dark:bg-white/5 text-lprimary dark:text-dprimary">
          <LuKeyboard size={32} />
        </span>
        <p className={clsx("text-lg font-semibold", mutedText)}>
          {t("Players type their answer — fast and exact scores best")}
        </p>
      </div>
    );
  },

  RevealBreakdown({ summary, hideCorrect }) {
    const t = useT();
    const maxCount = Math.max(1, ...summary.answers.map((a) => a.count));
    const twoCols = summary.answers.length >= 5;
    return (
      <div className="flex-1 flex flex-col gap-3">
        {!hideCorrect && (
          <CorrectGlow>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-[11.5px] font-bold tracking-[0.04em] uppercase text-white">
                <LuCheck size={13} strokeWidth={3} />
                {t("Correct")}
              </span>
              {summary.accepted.map((a) => (
                <b
                  key={a}
                  className="text-[17px] text-green-600 dark:text-green-500"
                >
                  {a}
                </b>
              ))}
            </div>
          </CorrectGlow>
        )}
        {summary.answers.length === 0 ? (
          <p className={clsx("text-sm py-6 text-center", mutedText)}>
            {t("Nobody answered.")}
          </p>
        ) : (
          <div
            className={clsx(
              "grid content-start",
              twoCols ? "gap-x-5 gap-y-2 sm:grid-cols-2" : "gap-3",
            )}
          >
            {summary.answers.map((a, i) => {
              const ok = !hideCorrect && a.correct;
              const pct = Math.round((a.count / summary.responses) * 100);
              return (
                <div key={`${a.text}-${i}`} className="flex flex-col gap-[7px]">
                  <div
                    className={clsx(
                      "flex items-center gap-2.5 text-[15px] font-semibold",
                      ok && "text-green-600 dark:text-green-500",
                    )}
                  >
                    <span className="flex-1 min-w-0 truncate">{a.text}</span>
                    {ok && a.precision < 1 && (
                      <span className={clsx("text-xs font-medium", mutedText)}>
                        {Math.round(a.precision * 100)}
                        {t("% exact")}
                      </span>
                    )}
                    <span className={clsx("text-sm font-medium", mutedText)}>
                      {a.count}
                    </span>
                  </div>
                  <ResultBar
                    fill={a.count / maxCount}
                    pct={pct}
                    correct={ok}
                    delayMs={i * 90}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  },

  revealStats(_question, { responses, correct }) {
    return { responses, correct };
  },

  describeAnswer(_question, answer) {
    return (
      <span className="line-clamp-3 wrap-break-word font-semibold">
        {answer.guess}
      </span>
    );
  },

  correctAnswers(_question, summary) {
    return summary.accepted.map((a) => <span key={a}>{a}</span>);
  },
};
