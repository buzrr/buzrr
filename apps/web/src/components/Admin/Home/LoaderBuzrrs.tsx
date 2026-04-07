"use client";
import clsx from "clsx";
import React from "react";
import { Skeleton } from "@mui/material";
import { useAppSelector } from "@/state/hooks";

const CardSkeleton = (): React.ReactNode => {
  const view = useAppSelector((state) => state.gridListToggle.view);
  return (
    <div
      className={clsx(
        "border border-[#c2b4fe] dark:border-transparent w-full bg-card-light dark:bg-card-dark text-dark dark:text-white rounded",
        view === "list" ? "md:w-full py-4 px-2" : "p-2 md:w-40 h-[50vh] md:h-44"
      )}
    >
      {view === "grid" ? (
        <>
          <Skeleton variant="text" sx={{ fontSize: "1rem" }} />
          <Skeleton variant="text" sx={{ fontSize: "0.75rem" }} />
        </>
      ) : (
        <Skeleton variant="rectangular" width="full" />
      )}
    </div>
  );
};

const LoaderBuzrrs = ({ cardCount }: { cardCount: number }) => {
  const cards: Array<React.ReactNode> = [];
  const view = useAppSelector((state) => state.gridListToggle.view);

  for (let i = 0; i < cardCount; i++) {
    cards.push(<CardSkeleton key={`card-skel-${i}`} />);
  }
  return (
    <div
      className={clsx("flex gap-x-3", view === "list" && "flex-col gap-y-3")}
    >
      {cards}
    </div>
  );
};

export default LoaderBuzrrs;
