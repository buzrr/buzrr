import { ImageResponse } from "next/og";
import { BRAND_PURPLE_LIGHT, LOGO_PATH, LOGO_VIEWBOX } from "./brand";
import { OG_IMAGE_SIZE } from "./metadata";

/**
 * The 1200×630 social card shared by every marketing page: wordmark, a small
 * eyebrow label and the page's headline. Text only — no screenshots — so it
 * stays legible when platforms crop or shrink it.
 */
export function renderSocialCard({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background:
          "linear-gradient(135deg, #1e1e1e 0%, #241a3d 60%, #3b1f8f 100%)",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <svg width={196} height={90} viewBox={LOGO_VIEWBOX}>
        <path d={LOGO_PATH} fill={BRAND_PURPLE_LIGHT} fillRule="evenodd" />
      </svg>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            fontWeight: 700,
            color: BRAND_PURPLE_LIGHT,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          {eyebrow}
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: title.length > 48 ? 60 : 72,
            fontWeight: 800,
            lineHeight: 1.1,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 28,
          color: "#c4c6c9",
        }}
      >
        Open source · Live quiz rooms · Ranked 1v1 battles · buzrr.in
      </div>
    </div>,
    OG_IMAGE_SIZE,
  );
}
