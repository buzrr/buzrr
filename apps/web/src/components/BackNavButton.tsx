"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/state/hooks";
import { PageTheme } from "@/state/pageThemeSlice";
import { IconButton } from "@/components/ui/IconButton";

/** Navigates to `href` when given, otherwise falls back to history.back(). */
const BackNavButton = ({ href }: { href?: string }) => {
  const theme = useAppSelector((state) => state.pageTheme.theme);
  const router = useRouter();

  return (
    <IconButton
      aria-label="Go back"
      className="cursor-pointer"
      onClick={() => (href ? router.push(href) : window.history.back())}
      icon={
        <Image
          src={
            theme === PageTheme.light
              ? "/images/arrow-back.svg"
              : "/images/arrow-back-light.svg"
          }
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
