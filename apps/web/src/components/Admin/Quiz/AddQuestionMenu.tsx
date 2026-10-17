"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { LuChevronDown, LuPlus } from "react-icons/lu";
import type { QuestionType } from "@buzrr/contract";
import BasicModal from "@/components/Modal";
import AddQuesForm from "@/components/Admin/Quiz/AddQuesForm";
import {
  QUESTION_TYPE_META,
  QUESTION_TYPE_ORDER,
  QuestionTypeIcon,
} from "@/components/QuestionTypes";
import { mutedText } from "@/components/Game/GameUI";

const SUBTITLES: Record<QuestionType, string> = {
  multiple_choice:
    "Write the question, fill in 2 to 8 options and mark the correct one — or turn on multiple answers.",
  true_false: "Write a statement and mark whether it's true or false.",
  poll: "Ask for opinions — there's no right answer and nothing is scored.",
  word_cloud: "Players answer in a word or two; the most common grow biggest.",
  rating: "Players rate on a scale; you see the average and the spread.",
  open_text: "Players write freely; answers appear on a wall.",
};

/** "Add Question" opens a menu of types; picking one opens the editor. */
export default function AddQuestionMenu({ quizId }: { quizId: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [type, setType] = useState<QuestionType | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((o) => !o)}
        className="w-full flex items-center justify-center gap-2 rounded-[14px] p-3.5 md:p-4 text-[15px] md:text-base font-bold text-white bg-[#1c1b22] dark:bg-dark-bg transition-[filter] hover:brightness-125 cursor-pointer"
      >
        <LuPlus size={20} strokeWidth={2.4} />
        Add Question
        <LuChevronDown
          size={16}
          className={clsx(
            "opacity-70 transition-transform duration-150",
            menuOpen && "rotate-180",
          )}
        />
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+8px)] z-20 w-[min(560px,calc(100vw-2rem))] md:w-[min(560px,100%)] flex flex-col gap-0.5 rounded-[18px] border p-2.5 bg-white dark:bg-dark border-lprimary/15 dark:border-white/5 shadow-[0_24px_60px_-20px_rgba(20,10,60,0.45)] text-dark dark:text-white animate-[fade-up_120ms_ease-out_both] motion-reduce:animate-none"
        >
          {QUESTION_TYPE_ORDER.map((t) => {
            const meta = QUESTION_TYPE_META[t];
            return (
              <button
                key={t}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setType(t);
                }}
                className="flex items-center gap-3 rounded-xl p-3 text-left cursor-pointer hover:bg-lprimary/8 dark:hover:bg-white/5 focus-visible:bg-lprimary/8 outline-none"
              >
                <span className="size-10 shrink-0 rounded-[11px] flex items-center justify-center bg-lprimary/8 dark:bg-white/5 text-lprimary dark:text-dprimary">
                  <QuestionTypeIcon type={t} size={19} />
                </span>
                <span className="min-w-0">
                  <b className="flex items-center gap-2 text-[15px]">
                    {meta.name}
                    {meta.scored && (
                      <span className="text-[10px] font-extrabold tracking-[0.06em] rounded-full px-[7px] py-0.5 text-green-600 dark:text-green-500 bg-green-500/12">
                        SCORED
                      </span>
                    )}
                  </b>
                  <small
                    className={clsx(
                      "block text-[12.5px] font-medium",
                      mutedText,
                    )}
                  >
                    {meta.description}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
      )}
      <BasicModal
        btnTitle="Add Question"
        wide
        subtitle={type ? SUBTITLES[type] : undefined}
        open={type !== null}
        onClose={() => setType(null)}
      >
        {type && (
          <AddQuesForm
            quizId={quizId}
            type={type}
            onDone={() => setType(null)}
          />
        )}
      </BasicModal>
    </div>
  );
}
