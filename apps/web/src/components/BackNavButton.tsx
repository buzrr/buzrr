"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { PageTheme } from "@/state/pageThemeSlice";
import { useRenderedTheme } from "@/hooks/useRenderedTheme";
import { useT } from "@/lib/i18n/context";
import { IconButton } from "@/components/ui/IconButton";

/**
 * Navigates to `href` when given, otherwise falls back to history.back().
 * `onBack`, when provided, overrides both (e.g. to confirm leaving a game).
 */
const BackNavButton = ({
  href,
  onBack,
}: {
  href?: string;
  onBack?: () => void;
}) => {
  const t = useT();
  const theme = useRenderedTheme();
  const router = useRouter();

  return (
    <IconButton
      aria-label={t("Go back")}
      className="cursor-pointer"
      onClick={() => {
        if (onBack) {
          onBack();
        } else if (href) {
          router.push(href);
        } else {
          window.history.back();
        }
      }}
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
