"use client";
import Image from "next/image";
import { useAppSelector } from "@/state/hooks";
import { PageTheme } from "@/state/pageThemeSlice";
import { IconButton } from "@/components/ui/IconButton";

const BackNavButton = () => {
  const theme = useAppSelector((state) => state.pageTheme.theme);

  return (
    <IconButton
      aria-label="Go back"
      className="cursor-pointer"
      onClick={() => window.history.back()}
      icon={
        <Image
          src={theme === PageTheme.light ? "images/arrow-back.svg" : "images/arrow-back-light.svg"}
          width={30}
          height={30}
          alt=""
          className="dark:text-white"
        />
      }
    />
  );
};

export default BackNavButton;
