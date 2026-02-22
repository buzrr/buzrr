"use client";
import { RootState } from "@/state/store";
import Image from "next/image";
import { useSelector } from "react-redux";
import { pageTheme } from "@/state/pageThemeSlice";

const BackNavButton = () => {
  const theme = useSelector((state: RootState) => state.pageTheme.theme);

  return (
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
  );
};

export default BackNavButton;
