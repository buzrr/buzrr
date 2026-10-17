"use client";

import clsx from "clsx";
import { useState, type ComponentProps } from "react";
import { LuPlus, LuX } from "react-icons/lu";
import { MAX_SUBMISSIONS } from "@buzrr/contract";
import { inputClass, mutedText } from "@/components/Game/GameUI";
import { SubmitButton } from "./Inputs";
import type { QuestionRenderer } from "./types";
import { useT, tx } from "@/lib/i18n/context";
import { WordCloudView } from "./Visuals";

function WordChip({ word, onRemove }: { word: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full pl-3.5 pr-2.5 py-2 font-bold text-lprimary dark:text-dprimary bg-lprimary/8 dark:bg-white/5">
      {word}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={tx("Remove {word}", { word })}
          className="cursor-pointer opacity-70 hover:opacity-100"
        >
          <LuX size={14} strokeWidth={2.6} />
        </button>
      )}
    </span>
  );
}

/** One word per send, as many as time allows; sent words stay listed. */
function RepeatInput({
  question,
  selected,
  disabled,
  onSubmit,
}: ComponentProps<QuestionRenderer<"word_cloud">["AnswerInput"]>) {
  const t = useT();
  const [text, setText] = useState("");
  const sent = selected?.words ?? [];
  const full = sent.length >= MAX_SUBMISSIONS;
  const word = text.trim();
  const send = () => {
    if (!word || disabled || full) return;
    onSubmit({ words: [word] });
    setText("");
  };
  return (
    <>
      {sent.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4 md:mt-7">
          {sent.map((w) => (
            <WordChip key={w} word={w} />
          ))}
        </div>
      )}
      <input
        className={clsx(inputClass, sent.length > 0 ? "mt-3" : "mt-4 md:mt-7")}
        placeholder={
          sent.length ? t("Add another word") : t("Type a word or short phrase")
        }
        value={text}
        maxLength={question.maxLength}
        disabled={disabled || full}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          send();
        }}
      />
      <span className={clsx("mt-3 text-[13.5px]", mutedText)}>
        {full
          ? t("That's the most words you can send")
          : sent.length
            ? t("Sent {n} · add as many as you like while time's left", {
                n: sent.length,
              })
            : t("Send one word at a time — as many as you like")}
      </span>
      <SubmitButton disabled={disabled || full || word === ""} onClick={send}>
        {sent.length ? t("Submit another") : "Submit"}
      </SubmitButton>
    </>
  );
}

/** Up to `maxAnswers` words, sent together once. */
function BatchInput({
  question,
  selected,
  disabled,
  onSubmit,
}: ComponentProps<QuestionRenderer<"word_cloud">["AnswerInput"]>) {
  const t = useT();
  const [words, setWords] = useState<string[]>([]);
  const [text, setText] = useState("");
  const { maxAnswers, maxLength } = question;

  if (selected) {
    return (
      <div className="flex flex-wrap gap-2 mt-4 md:mt-7">
        {selected.words.map((w) => (
          <WordChip key={w} word={w} />
        ))}
      </div>
    );
  }

  const pending = text.trim();
  const isDup = (w: string) =>
    words.some((x) => x.toLowerCase() === w.toLowerCase());
  // A typed-but-not-added word is sent too, so one-word answers need no
  // extra tap.
  const toSend = pending && !isDup(pending) ? [...words, pending] : words;
  const canAdd =
    maxAnswers > 1 &&
    pending !== "" &&
    !isDup(pending) &&
    words.length < maxAnswers - 1;
  const add = () => {
    if (!canAdd) return;
    setWords([...words, pending]);
    setText("");
  };
  const left = maxAnswers - toSend.length;

  return (
    <>
      <div className="flex gap-2 mt-4 md:mt-7">
        <input
          className={inputClass}
          placeholder={t("Type a word or short phrase")}
          value={text}
          maxLength={maxLength}
          disabled={disabled || (toSend.length >= maxAnswers && pending === "")}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (canAdd) add();
            else if (toSend.length > 0 && !disabled)
              onSubmit({ words: toSend });
          }}
        />
        {maxAnswers > 1 && (
          <button
            type="button"
            onClick={add}
            disabled={!canAdd}
            aria-label={t("Add answer")}
            className="shrink-0 rounded-[14px] px-4 border-[1.5px] border-lprimary/15 dark:border-white/10 text-lprimary dark:text-dprimary disabled:opacity-40 cursor-pointer disabled:cursor-default"
          >
            <LuPlus size={20} />
          </button>
        )}
      </div>
      {words.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {words.map((w) => (
            <WordChip
              key={w}
              word={w}
              onRemove={() => setWords(words.filter((x) => x !== w))}
            />
          ))}
        </div>
      )}
      <span className={clsx("mt-3 text-[13.5px]", mutedText)}>
        {maxAnswers === 1
          ? t("One answer · up to {n} characters", { n: maxLength })
          : t("You can add up to {n} answers · {left} left", {
              n: maxAnswers,
              left: Math.max(0, left),
            })}
      </span>
      <SubmitButton
        disabled={disabled || toSend.length === 0}
        onClick={() => onSubmit({ words: toSend })}
      />
    </>
  );
}

export const wordCloudRenderer: QuestionRenderer<"word_cloud"> = {
  AnswerInput(props) {
    return props.question.multipleSubmissions ? (
      <RepeatInput {...props} />
    ) : (
      <BatchInput {...props} />
    );
  },

  HostPrompt({ live }) {
    return <WordCloudView words={live?.words ?? []} />;
  },

  RevealBreakdown({ summary }) {
    return <WordCloudView words={summary.words} />;
  },

  revealStats(_question, { responses }) {
    return { responses, correct: 0 };
  },

  describeAnswer(_question, answer) {
    return (
      <span className="flex flex-wrap gap-2">
        {answer.words.map((w) => (
          <WordChip key={w} word={w} />
        ))}
      </span>
    );
  },

  correctAnswers() {
    return [];
  },
};
