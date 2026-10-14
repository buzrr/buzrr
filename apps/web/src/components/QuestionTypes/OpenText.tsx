"use client";

import clsx from "clsx";
import { useState, type ComponentProps } from "react";
import { MAX_SUBMISSIONS, type QuestionAnswer } from "@buzrr/contract";
import {
  counterClass,
  inputClass,
  mutedText,
  subtleCardClass,
} from "@/components/Game/GameUI";
import { Switch } from "@/components/ui/Switch";
import { SubmitButton } from "./Inputs";
import type { QuestionRenderer } from "./types";
import { TextWall } from "./Visuals";

type Entry = { text: string; anonymous: boolean };

/** Sent as one `{ text }`, stored as `{ entries }`; either reads as a list. */
function entriesOf(answer: QuestionAnswer<"open_text"> | null): Entry[] {
  if (!answer) return [];
  return "entries" in answer ? answer.entries : [answer];
}

function SentList({ entries }: { entries: Entry[] }) {
  return (
    <div className="flex flex-col gap-2 mt-4 md:mt-7">
      {entries.map((entry, i) => (
        <div
          key={i}
          className={clsx(
            "rounded-2xl px-4 py-3 text-[15px] font-medium leading-normal wrap-break-word animate-fade-up",
            subtleCardClass,
          )}
        >
          {entry.text}
          {entry.anonymous && (
            <small
              className={clsx("block mt-1 text-xs font-semibold", mutedText)}
            >
              Posted anonymously
            </small>
          )}
        </div>
      ))}
    </div>
  );
}

function AnswerForm({
  question,
  selected,
  disabled,
  onSubmit,
}: ComponentProps<QuestionRenderer<"open_text">["AnswerInput"]>) {
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const sent = entriesOf(selected);
  const repeat = question.multipleSubmissions;
  // One answer each: once sent, show it and stop.
  if (!repeat && sent.length > 0) return <SentList entries={sent} />;
  const full = sent.length >= MAX_SUBMISSIONS;

  const send = () => {
    const value = text.trim();
    if (!value || disabled || full) return;
    onSubmit({ text: value, anonymous });
    setText("");
  };

  return (
    <>
      {sent.length > 0 && <SentList entries={sent} />}
      <textarea
        className={clsx(
          inputClass,
          sent.length > 0 ? "mt-3" : "mt-4 md:mt-7",
          "min-h-[130px] resize-none leading-normal",
        )}
        placeholder={sent.length ? "Add another answer" : "Type your answer"}
        value={text}
        maxLength={question.maxLength}
        disabled={disabled || full}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex items-center justify-between gap-3 mt-2.5">
        {question.allowAnonymous ? (
          <label
            className={clsx(
              "flex items-center gap-2.5 text-[13.5px] cursor-pointer",
              mutedText,
            )}
          >
            <Switch
              checked={anonymous}
              onCheckedChange={setAnonymous}
              aria-label="Post anonymously"
              disabled={disabled || full}
            />
            Post anonymously
          </label>
        ) : (
          <span />
        )}
        <span className={counterClass}>
          {text.length} / {question.maxLength}
        </span>
      </div>
      {repeat && (
        <span className={clsx("mt-2 text-[13.5px]", mutedText)}>
          {full
            ? "That's the most answers you can send"
            : "You can send as many answers as you like while time's left"}
        </span>
      )}
      <SubmitButton
        disabled={disabled || full || text.trim() === ""}
        onClick={send}
      >
        {sent.length ? "Submit another" : "Submit"}
      </SubmitButton>
    </>
  );
}

export const openTextRenderer: QuestionRenderer<"open_text"> = {
  AnswerInput(props) {
    return <AnswerForm {...props} />;
  },

  HostPrompt({ live }) {
    return <TextWall entries={live?.entries ?? []} />;
  },

  RevealBreakdown({ summary }) {
    return <TextWall entries={summary.entries} />;
  },

  revealStats(_question, { responses }) {
    return { responses, correct: 0 };
  },

  describeAnswer(_question, answer) {
    const entries = entriesOf(answer);
    if (entries.length === 1) {
      return (
        <span className="line-clamp-4 wrap-break-word font-medium">
          {entries[0]!.text}
        </span>
      );
    }
    return (
      <ul className="flex flex-col gap-1.5 list-disc pl-5 font-medium">
        {entries.map((e, i) => (
          <li key={i} className="line-clamp-2 wrap-break-word">
            {e.text}
          </li>
        ))}
      </ul>
    );
  },

  correctAnswers() {
    return [];
  },
};
