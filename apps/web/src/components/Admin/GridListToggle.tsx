"use client";

import clsx from "clsx";
import { setGridListToggle } from "@/state/admin/gridListSlice";
import { RootState } from "@/state/store";
import { IoGridOutline } from "react-icons/io5";
import { useDispatch, useSelector } from "react-redux";
import { FaListUl } from "react-icons/fa6";

export default function GridListToggle() {
  const view = useSelector((state: RootState) => state.gridListToggle.view);
  const dispatch = useDispatch();
  function handleToggle({ view }: { view: string }) {
    dispatch(setGridListToggle(view));
  }
  return (
    <>
      <div className="grid grid-cols-2 bg-card-light dark:bg-[#332D40] rounded-lg shadow-[0px_4px_4px_-1px_rgba(36,104,147,0.04)] h-fit p-2 gap-x-2">
        <div
          className={clsx("cursor-pointer flex gap-x-1 items-center rounded-md p-2", view === "grid" && "bg-white dark:bg-[#27272A]")}
          onClick={() => {
            handleToggle({ view: "grid" });
          }}
        >
          <IoGridOutline className="dark:text-white" />
          <span className="dark:text-white hidden md:inline">Grid</span>
        </div>
        <div
          className={clsx("cursor-pointer flex gap-x-1 items-center p-2 rounded-md", view === "list" && "bg-white dark:bg-[#27272A]")}
          onClick={() => {
            handleToggle({ view: "list" });
          }}
        >
          <FaListUl className="dark:text-white" />
          <span className="dark:text-white hidden md:inline">List</span>
        </div>
      </div>
    </>
  );
}
