"use client";
import clsx from "clsx";
import { quizCardClass } from "./QuizCard";
import { quizGridClass } from "./ClientBuzrrs";
import { useAppSelector } from "@/state/hooks";

function Bone({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-md bg-lprimary/10 dark:bg-white/10",
        className,
      )}
    />
  );
}

function CardSkeleton({ view }: { view: "grid" | "list" }) {
  if (view === "list") {
    return (
      <div className={quizCardClass("list")}>
        <Bone className="size-10 md:size-12 rounded-[13px] shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Bone className="h-4 w-1/3" />
          <Bone className="h-3 w-1/2" />
        </div>
        <Bone className="hidden sm:block h-3 w-40 shrink-0" />
      </div>
    );
  }
  return (
    <div className={quizCardClass("grid")}>
      <div className="flex items-center gap-3.5">
        <Bone className="size-10 md:size-12 rounded-[13px] shrink-0" />
        <Bone className="h-4 w-1/2" />
      </div>
      <Bone className="h-3 w-3/4" />
      <div className="mt-auto pt-3 border-t border-lprimary/15 dark:border-white/10 flex gap-4">
        <Bone className="h-3 w-20" />
        <Bone className="h-3 w-14" />
      </div>
    </div>
  );
}

const LoaderBuzrrs = ({ cardCount }: { cardCount: number }) => {
  const view = useAppSelector((state) => state.gridListToggle.view);

  return (
    <div
      className={quizGridClass(view)}
      aria-busy="true"
      aria-label="Loading quizzes"
    >
      {Array.from({ length: cardCount }, (_, i) => (
        <CardSkeleton key={`card-skel-${i}`} view={view} />
      ))}
    </div>
  );
};

export default LoaderBuzrrs;
