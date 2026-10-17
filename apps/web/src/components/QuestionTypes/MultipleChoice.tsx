"use client";

import clsx from "clsx";
import {
  useContext,
  createContext,
  useState,
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import { LuCheck } from "react-icons/lu";
import {
  OPTION_KEYS,
  OptionKey,
  mutedText,
  subtleCardClass,
} from "@/components/Game/GameUI";
import { Tooltip } from "@/components/ui/Tooltip";
import { AnimatedNumber, useEntered } from "@/components/Game/motion";
import { ChoiceList, SubmitButton, toggleChoice } from "./Inputs";
import { useT } from "@/lib/i18n/context";
import type { QuestionRenderer } from "./types";

export function OptionLabel({
  index,
  title,
}: {
  index: number;
  title: string;
}) {
  return (
    <>
      <OptionKey index={index} className="size-9 text-base" />
      <span className="min-w-0 wrap-break-word">{title}</span>
    </>
  );
}

const BAR_MS = 900;

/** A reveal bar that grows from empty, its percentage counting up alongside. */
export function ResultBar({
  fill,
  pct,
  correct,
  delayMs,
}: {
  /** 0–1, relative to the most-picked option. */
  fill: number;
  pct: number;
  correct: boolean;
  delayMs: number;
}) {
  const entered = useEntered();
  return (
    <div className="relative h-[38px] rounded-xl overflow-hidden bg-lprimary/8 dark:bg-white/5">
      <div
        className={clsx(
          "h-full rounded-xl transition-[width] ease-out motion-reduce:transition-none",
          correct
            ? "bg-green-500"
            : "bg-bar-muted/45 dark:bg-bar-muted-dark/45",
        )}
        style={{
          width: `${entered ? fill * 100 : 0}%`,
          transitionDuration: `${BAR_MS}ms`,
          transitionDelay: `${delayMs}ms`,
        }}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13.5px] font-bold tabular-nums">
        <AnimatedNumber
          value={entered ? pct : 0}
          from={0}
          duration={BAR_MS}
          delay={delayMs}
        />
        %
      </span>
    </div>
  );
}

/** Steps option text down as the longest option grows, so four still fit. */
function optionTextClass(options: { title: string }[]) {
  const longest = Math.max(0, ...options.map((o) => o.title.length));
  if (longest > 80) return "text-[15px] md:text-base";
  if (longest > 40) return "text-base md:text-lg";
  return "text-[17px] md:text-xl";
}

/**
 * How the room answered an option question, the right option(s) flagged.
 * Shared by the scored option types.
 */
/** The right answer lights up: green border and a light green fill. */
export function CorrectGlow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.animate(
      [
        {
          borderColor: "rgba(34,197,94,0)",
          backgroundColor: "rgba(34,197,94,0)",
          boxShadow: "0 0 0 0 rgba(34,197,94,0)",
          transform: "scale(1)",
        },
        {
          borderColor: "rgba(34,197,94,1)",
          backgroundColor: "rgba(34,197,94,0.3)",
          boxShadow: "0 0 0 8px rgba(34,197,94,0.25)",
          transform: "scale(1.05)",
          offset: 0.4,
        },
        {
          borderColor: "rgba(34,197,94,1)",
          backgroundColor: "rgba(34,197,94,0.14)",
          boxShadow: "0 0 0 0 rgba(34,197,94,0)",
          transform: "scale(1)",
        },
      ],
      {
        duration: 1300,
        delay: 250,
        easing: "cubic-bezier(.2,.8,.2,1)",
        fill: "both",
      },
    );
  }, []);
  return (
    <div
      ref={ref}
      className="-mx-2.5 rounded-xl border-2 border-transparent px-2.5 py-1.5"
    >
      {children}
    </div>
  );
}

/**
 * How tight the results view must be to fit its panel: 0 = normal, 1 =
 * tighter, 2 = tightest (two columns from three options). Set by the host's
 * results screen when its panel overflows.
 */
export const RevealDensity = createContext(0);

export function OptionsReveal({
  options,
  counts,
  correctOptionIds,
  renderKey = (i) => <>{OPTION_KEYS[i]}.</>,
}: {
  options: { id: string; title: string }[];
  counts: number[];
  correctOptionIds: string[];
  renderKey?: (index: number) => ReactNode;
}) {
  const t = useT();
  const density = useContext(RevealDensity);
  // Bars share out the picks; with multi-select one player can count twice.
  const picks = counts.reduce((sum, c) => sum + c, 0);
  const maxCount = Math.max(1, ...counts);
  // Every option has to fit on screen: from five options on two columns —
  // from three when the panel is short (e.g. a tablet, a two-line question).
  const twoCols = options.length >= (density >= 2 ? 3 : 5);
  return (
    <div
      className={clsx(
        "flex-1 grid content-center",
        twoCols
          ? "gap-x-5 gap-y-1 sm:grid-cols-2"
          : density >= 1
            ? "gap-1.5"
            : "gap-3.5",
        density >= 1 && "[&_.reveal-row]:gap-1 [&_.reveal-label]:text-[14px]",
      )}
    >
      {options.map((opt, i) => {
        const count = counts[i] ?? 0;
        const ok = correctOptionIds.includes(opt.id);
        const pct = picks > 0 ? Math.round((count / picks) * 100) : 0;
        const row = (
          <div className="reveal-row flex flex-col gap-[7px]">
            <div
              className={clsx(
                "reveal-label flex items-center gap-2.5 text-[15px] font-semibold",
                ok && "text-green-600 dark:text-green-500",
              )}
            >
              <Tooltip
                content={opt.title}
                onlyWhenTruncated
                className="flex-1 min-w-0 truncate"
              >
                {renderKey(i)} {opt.title}
              </Tooltip>
              {ok && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-[11.5px] font-bold tracking-[0.04em] uppercase text-white">
                  <LuCheck size={13} strokeWidth={3} />
                  {t("Correct")}
                </span>
              )}
              <span className={clsx("text-sm font-medium", mutedText)}>
                {count} {count === 1 ? "vote" : "votes"}
              </span>
            </div>
            <ResultBar
              fill={count / maxCount}
              pct={pct}
              correct={ok}
              delayMs={i * 90}
            />
          </div>
        );
        return ok ? (
          <CorrectGlow key={opt.id}>{row}</CorrectGlow>
        ) : (
          <div
            key={opt.id}
            className="-mx-2.5 px-2.5 py-1.5 border-2 border-transparent"
          >
            {row}
          </div>
        );
      })}
    </div>
  );
}

/** Tick every option you think is right, then submit the set. */
function MultiSelectInput({
  question,
  selected,
  disabled,
  onSubmit,
}: ComponentProps<QuestionRenderer<"multiple_choice">["AnswerInput"]>) {
  const t = useT();
  const [draft, setDraft] = useState<string[]>([]);
  const sent =
    selected && "optionIds" in selected
      ? selected.optionIds
      : selected
        ? [selected.optionId]
        : null;
  const chosen = sent ?? draft;
  return (
    <>
      <p className={clsx("mt-3 text-sm font-medium", mutedText)}>
        {t("Select all that apply.")}
      </p>
      <ChoiceList
        options={question.options}
        multi
        chosen={chosen}
        disabled={disabled}
        onToggle={(id) => setDraft((d) => toggleChoice(d, id, true))}
      />
      {!sent && (
        <SubmitButton
          disabled={disabled || draft.length === 0}
          onClick={() => onSubmit({ optionIds: draft })}
        />
      )}
    </>
  );
}

export const multipleChoiceRenderer: QuestionRenderer<"multiple_choice"> = {
  AnswerInput(props) {
    const { question, selected, disabled, onSubmit } = props;
    if (question.multiSelect) return <MultiSelectInput {...props} />;
    const picked =
      selected && "optionId" in selected ? selected.optionId : null;
    const textClass = optionTextClass(question.options);
    return (
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 md:auto-rows-fr gap-2.5 md:gap-3.5 mt-4 md:mt-7">
        {question.options.map((option, index) => {
          const isPicked = option.id === picked;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!disabled) onSubmit({ optionId: option.id });
              }}
              aria-pressed={isPicked}
              className={clsx(
                "flex items-center gap-4 rounded-[18px] border-[1.5px] px-3.5 py-2.5 md:px-[22px] md:py-[18px] min-h-14 md:min-h-[84px] font-semibold leading-snug text-left text-pretty wrap-break-word min-w-0 transition-all duration-150",
                textClass,
                isPicked
                  ? "border-lprimary dark:border-dprimary bg-lprimary/10 dark:bg-dprimary/15 shadow-[0_10px_24px_-14px_#7c4ddb] animate-pop"
                  : subtleCardClass,
                !disabled &&
                  "cursor-pointer hover:border-dprimary hover:-translate-y-0.5 active:scale-[0.98]",
                disabled && !isPicked && "opacity-50 cursor-default",
              )}
            >
              <OptionKey index={index} className="size-9 md:size-11 text-lg" />
              <span className="min-w-0">{option.title}</span>
            </button>
          );
        })}
      </div>
    );
  },

  HostPrompt({ question }) {
    const t = useT();
    // Rows size to their content; the panel scrolls if it ever overflows.
    return (
      <>
        {question.multiSelect && (
          <p className={clsx("mt-3 text-sm font-medium", mutedText)}>
            {t("Players select all that apply")}
          </p>
        )}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 md:auto-rows-fr gap-3.5 mt-7">
          {question.options.map((opt, index) => (
            <div
              key={opt.id}
              className={clsx(
                "flex items-center gap-4 rounded-[18px] border-[1.5px] px-4 py-3.5 md:px-[22px] md:py-[18px] min-h-16 md:min-h-[84px] font-semibold leading-snug text-pretty wrap-break-word min-w-0",
                optionTextClass(question.options),
                subtleCardClass,
              )}
            >
              <OptionKey index={index} className="size-10 md:size-11 text-lg" />
              <span className="min-w-0">{opt.title}</span>
            </div>
          ))}
        </div>
      </>
    );
  },

  RevealBreakdown({ question, summary, hideCorrect }) {
    return (
      <OptionsReveal
        options={question.options}
        counts={summary.counts}
        correctOptionIds={hideCorrect ? [] : summary.correctOptionIds}
      />
    );
  },

  revealStats(_question, { responses, correct }) {
    return { responses, correct };
  },

  describeAnswer(question, answer) {
    const ids = "optionIds" in answer ? answer.optionIds : [answer.optionId];
    const labels = question.options.flatMap((option, index) =>
      ids.includes(option.id)
        ? [<OptionLabel key={option.id} index={index} title={option.title} />]
        : [],
    );
    if (labels.length === 0) return null;
    if (labels.length === 1) return labels[0];
    return (
      <div className="flex flex-col gap-2.5">
        {labels.map((l) => (
          <span key={l.key} className="flex items-center gap-3.5">
            {l}
          </span>
        ))}
      </div>
    );
  },

  correctAnswers(question, summary) {
    return question.options.flatMap((option, index) =>
      summary.correctOptionIds.includes(option.id)
        ? [<OptionLabel key={option.id} index={index} title={option.title} />]
        : [],
    );
  },
};
