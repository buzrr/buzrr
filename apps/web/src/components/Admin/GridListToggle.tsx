"use client";

import clsx from "clsx";
import { setGridListToggle } from "@/state/admin/gridListSlice";
import { IoGridOutline } from "react-icons/io5";
import { useAppDispatch, useAppSelector } from "@/state/hooks";
import { FaListUl } from "react-icons/fa6";
import { IconButton } from "@/components/ui/IconButton";

export default function GridListToggle() {
  const view = useAppSelector((state) => state.gridListToggle.view);
  const dispatch = useAppDispatch();

  return (
    <div
      role="group"
      aria-label="View mode"
      className="grid grid-cols-2 bg-card-light dark:bg-[#332D40] rounded-lg shadow-[0px_4px_4px_-1px_rgba(36,104,147,0.04)] h-fit p-2 gap-x-2"
    >
      <IconButton
        aria-pressed={view === "grid"}
        className={clsx(
          "cursor-pointer flex gap-x-1 items-center rounded-md p-2",
          view === "grid" && "bg-white dark:bg-[#27272A]",
        )}
        onClick={() => dispatch(setGridListToggle("grid"))}
        icon={
          <>
            <IoGridOutline className="dark:text-white" />
            <span className="dark:text-white hidden md:inline">Grid</span>
          </>
        }
      />
      <IconButton
        aria-pressed={view === "list"}
        className={clsx(
          "cursor-pointer flex gap-x-1 items-center p-2 rounded-md",
          view === "list" && "bg-white dark:bg-[#27272A]",
        )}
        onClick={() => dispatch(setGridListToggle("list"))}
        icon={
          <>
            <FaListUl className="dark:text-white" />
            <span className="dark:text-white hidden md:inline">List</span>
          </>
        }
      />
    </div>
  );
}
