"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  LuEllipsisVertical,
  LuExternalLink,
  LuLayers,
  LuPencil,
  LuTrash2,
  LuUsers,
} from "react-icons/lu";
import type { QuizListItem } from "@/lib/modules/quizzes/api";

function quizHue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return 245 + (Math.abs(h) % 50);
}

export function quizMonogramStyle(id: string) {
  const hue = quizHue(id);
  return {
    background: `linear-gradient(140deg, oklch(0.68 0.17 ${hue}), oklch(0.52 0.2 ${hue}))`,
  };
}

export function quizCardClass(view: "grid" | "list") {
  return clsx(
    "relative rounded-[18px] border bg-light-bg dark:bg-card-dark border-lprimary/15 dark:border-white/5 text-dark dark:text-white",
    view === "grid"
      ? "flex flex-col gap-3.5 p-4 md:p-5 min-h-[168px]"
      : "flex items-center gap-4 p-4 pr-14",
  );
}

function QuizMenu({
  quizHref,
  view,
  onOpenChange,
  onEdit,
  onDelete,
}: {
  quizHref: string;
  view: "grid" | "list";
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpenState] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange(next);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenState(false);
        onOpenChange(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenState(false);
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  const itemClass =
    "flex items-center gap-2.5 w-full rounded-[9px] px-3 py-2.5 text-sm font-medium text-left cursor-pointer transition-colors [&>svg]:size-4";

  return (
    <div
      ref={ref}
      className={clsx(
        "absolute right-3 md:right-3.5 z-10",
        view === "grid" ? "top-3 md:top-3.5" : "top-1/2 -translate-y-1/2",
      )}
    >
      <button
        type="button"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={clsx(
          "size-[34px] rounded-[10px] border flex items-center justify-center cursor-pointer transition-colors",
          open
            ? "bg-lprimary/10 dark:bg-white/5 text-dark dark:text-white border-lprimary/15 dark:border-white/5"
            : "border-transparent text-off-dark dark:text-[#9a9aa2] hover:bg-lprimary/10 dark:hover:bg-white/5 hover:text-dark dark:hover:text-white",
        )}
      >
        <LuEllipsisVertical size={18} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute top-10 right-0 min-w-[168px] p-1.5 rounded-[13px] flex flex-col gap-0.5 bg-white dark:bg-[#4a494c] border border-lprimary/15 dark:border-white/5 shadow-[0_18px_40px_-14px_rgba(60,30,140,0.28)] dark:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)]"
        >
          <Link
            role="menuitem"
            href={quizHref}
            className={clsx(
              itemClass,
              "text-dark dark:text-white hover:bg-lprimary/10 dark:hover:bg-white/5 [&>svg]:text-off-dark dark:[&>svg]:text-[#9a9aa2]",
            )}
            onClick={() => setOpen(false)}
          >
            <LuExternalLink />
            Open
          </Link>
          <button
            type="button"
            role="menuitem"
            className={clsx(
              itemClass,
              "text-dark dark:text-white hover:bg-lprimary/10 dark:hover:bg-white/5 [&>svg]:text-off-dark dark:[&>svg]:text-[#9a9aa2]",
            )}
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            <LuPencil />
            Edit
          </button>
          <div className="h-px mx-2 my-0.5 bg-lprimary/15 dark:bg-white/10" />
          <button
            type="button"
            role="menuitem"
            className={clsx(
              itemClass,
              "text-red-light dark:text-red-dark hover:bg-[#e5544e]/12",
            )}
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            <LuTrash2 />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function QuizCard({
  quiz,
  view,
  onEdit,
  onDelete,
}: {
  quiz: QuizListItem;
  view: "grid" | "list";
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const href = `/admin/quiz/${quiz.id}`;
  const questions = quiz._count?.questions ?? 0;
  const plays = quiz._count?.gameResults ?? 0;

  const meta = (
    <div
      className={clsx(
        "flex flex-wrap items-center gap-x-4 gap-y-1 text-xs md:text-[12.5px] font-medium text-[#8a8896] dark:text-[#9a9aa2] [&>span]:flex [&>span]:items-center [&>span]:gap-1.5",
        view === "grid"
          ? "mt-auto pt-3 border-t border-lprimary/15 dark:border-white/10"
          : "hidden sm:flex shrink-0",
      )}
    >
      <span>
        <LuLayers size={14} />
        {questions} question{questions === 1 ? "" : "s"}
      </span>
      <span>
        <LuUsers size={14} />
        {plays} play{plays === 1 ? "" : "s"}
      </span>
    </div>
  );

  return (
    <div
      className={clsx(
        quizCardClass(view),
        "transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-[3px] hover:border-lprimary dark:hover:border-dprimary hover:shadow-[0_16px_34px_-16px_rgba(0,0,0,0.5)]",
        menuOpen && "z-20",
      )}
    >
      <Link
        href={href}
        aria-label={`Open ${quiz.title}`}
        className="absolute inset-0 rounded-[18px]"
      />
      <div className="flex items-center gap-3.5 min-w-0 pr-10">
        <div
          aria-hidden="true"
          className="size-10 md:size-12 shrink-0 rounded-[13px] flex items-center justify-center text-lg md:text-[22px] font-bold text-white"
          style={quizMonogramStyle(quiz.id)}
        >
          {quiz.title.trim()[0]?.toUpperCase() ?? "?"}
        </div>
        {view === "list" ? (
          <div className="min-w-0">
            <h3 className="text-base md:text-lg font-semibold truncate">
              {quiz.title}
            </h3>
            {quiz.description && (
              <p className="text-xs md:text-[13.5px] text-off-dark dark:text-[#9a9aa2] truncate">
                {quiz.description}
              </p>
            )}
          </div>
        ) : (
          <h3 className="text-base md:text-lg font-semibold truncate min-w-0">
            {quiz.title}
          </h3>
        )}
      </div>
      {view === "grid" && (
        <p className="text-xs md:text-[13.5px] text-off-dark dark:text-[#9a9aa2] line-clamp-2">
          {quiz.description || "No description"}
        </p>
      )}
      {view === "list" && <div className="flex-1" />}
      {meta}
      <QuizMenu
        quizHref={href}
        view={view}
        onOpenChange={setMenuOpen}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}
