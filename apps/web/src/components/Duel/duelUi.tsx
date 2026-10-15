import type { SVGProps } from "react";

/** Category swatch colour from its OKLCH hue (matches the design kit). */
export function categorySwatch(hue: number): string {
  return `oklch(0.62 0.17 ${hue})`;
}

/** Hue for the "Random" tile. */
export const RANDOM_HUE = 270;

/** 18200 → "18.2k". */
export function formatPlays(n: number): string {
  if (n >= 1_000_000) return `${trimZero(n / 1_000_000)}M`;
  if (n >= 1_000) return `${trimZero(n / 1_000)}k`;
  return String(n);
}

function trimZero(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function stroke({ size = 20, ...props }: IconProps, width = 2) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: width,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

/** Two-tone flame used for the daily streak. */
export function FlameIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...props}>
      <path
        d="M12 2.5c.6 3.2 2.6 4.8 4.2 6.6A7.5 7.5 0 1 1 5.6 12c.9 1.3 2 2 3.2 2.1-.6-3.9.8-8.2 3.2-11.6Z"
        fill="currentColor"
      />
      <path
        d="M12 13c1.6 1.4 3 2.6 3 4.6a3 3 0 1 1-6 0c0-1.4.8-2.4 1.6-3 .1 1 .6 1.6 1.2 1.8-.3-1.2-.2-2.3.2-3.4Z"
        fill="#ffd27a"
      />
    </svg>
  );
}

export function ShuffleIcon(props: IconProps) {
  return (
    <svg {...stroke(props)}>
      <path d="M3 7h3.5c4.5 0 6.5 10 11 10H21m0 0-3-3m3 3-3 3M3 17h3.5c1.6 0 2.8-1.2 3.8-2.8M21 7h-3.5c-1.6 0-2.8 1.2-3.8 2.8M21 7l-3-3m3 3-3 3" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...stroke(props)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...stroke(props, 2.4)}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...stroke(props, 2.4)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...stroke(props, 2.6)}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...stroke(props, 2.4)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function TrophyIcon(props: IconProps) {
  return (
    <svg {...stroke(props)}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Zm0 2H4v1a3 3 0 0 0 3 3m10-4h3v1a3 3 0 0 1-3 3M9 20h6m-3-6v6" />
    </svg>
  );
}
