"use client";
import { RootState } from "@/state/store";
import Image from "next/image";
import { useSelector } from "react-redux";
import { pageTheme } from "@/state/pageThemeSlice";

const BackNavButton = () => {
  const theme = useSelector((state: RootState) => state.pageTheme.theme);

  return (
    <div className="m-2 mx-3">
      <Image
        src={`${theme === pageTheme.light ? "images/arrow-back.svg" : "images/arrow-back-light.svg"}`}
        width={30}
        height={30}
        alt="Logo"
        className="hover:cursor-pointer dark:text-white"
        onClick={() => {
          window.history.back();
        }}
      />
    </div>
  );
};

export default BackNavButton;
