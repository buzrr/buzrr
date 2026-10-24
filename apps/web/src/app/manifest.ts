import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, siteName } from "@/lib/seo/site";

export const dynamic = "force-dynamic";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName(),
    short_name: siteName(),
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "browser",
    background_color: "#f5f3ff",
    theme_color: "#7d49f8",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
