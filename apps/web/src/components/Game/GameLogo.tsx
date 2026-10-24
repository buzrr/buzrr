"use client";

import { useT } from "@/lib/i18n/context";
import ClientImage from "@/components/ClientImage";

/**
 * The logo on a game screen: the quiz's own logo when it has one, the site
 * logo otherwise.
 */
export default function GameLogo({
  logo,
  size,
}: {
  logo?: string | null;
  size: number;
}) {
  const t = useT();
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed upload URL, any aspect ratio
      <img
        src={logo}
        alt={t("Quiz logo")}
        style={{ maxHeight: size, maxWidth: size * 3 }}
        className="shrink-0 object-contain"
      />
    );
  }
  return (
    <ClientImage
      props={{
        src: "/images/logo.svg",
        darksrc: "/images/logo-dark.svg",
        alt: "Logo",
        width: size,
        height: size,
      }}
    />
  );
}
