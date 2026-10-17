"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { mutedText } from "@/components/Game/GameUI";

const MESSAGES = [
  "Reading your topic…",
  "Brewing questions…",
  "Sprinkling in answer choices…",
  "Double-checking the facts…",
  "Adding a little sparkle…",
  "Almost there…",
];
const MESSAGE_MS = 2400;

/** Four-point star, 24×24 box. */
const STAR_PATH =
  "M12 0C12.9 7.6 16.4 11.1 24 12C16.4 12.9 12.9 16.4 12 24C11.1 16.4 7.6 12.9 0 12C7.6 11.1 11.1 7.6 12 0Z";

/**
 * Burst around the wand tip (which sits near 70% / 28% of the stage). Each one
 * drifts out along (dx, dy) while it twinkles; delays stagger the bursts.
 */
const SPARKLES = [
  { x: 70, y: 10, size: 24, dx: 6, dy: -18, delay: 0, gold: false },
  { x: 88, y: 20, size: 18, dx: 18, dy: -8, delay: 0.35, gold: true },
  { x: 90, y: 42, size: 21, dx: 16, dy: 10, delay: 0.7, gold: false },
  { x: 52, y: 14, size: 15, dx: -14, dy: -14, delay: 0.95, gold: true },
  { x: 78, y: 4, size: 14, dx: 4, dy: -20, delay: 1.2, gold: false },
  { x: 96, y: 30, size: 12, dx: 20, dy: 0, delay: 0.5, gold: true },
  { x: 60, y: 30, size: 12, dx: -10, dy: 4, delay: 1.45, gold: false },
  { x: 82, y: 52, size: 15, dx: 8, dy: 18, delay: 0.2, gold: true },
  { x: 18, y: 30, size: 16, dx: -6, dy: -10, delay: 1.7, gold: false },
  { x: 30, y: 8, size: 10, dx: -8, dy: -12, delay: 0.85, gold: true },
  { x: 66, y: 22, size: 20, dx: -4, dy: -22, delay: 0.6, gold: true },
  { x: 92, y: 10, size: 15, dx: 14, dy: -16, delay: 1.05, gold: false },
  { x: 74, y: 40, size: 14, dx: 10, dy: 12, delay: 1.6, gold: true },
  { x: 44, y: 22, size: 14, dx: -16, dy: -6, delay: 0.1, gold: false },
];

/** Faint stars twinkling across the whole modal, not just round the wand. */
const AMBIENT = [
  { x: 8, y: 12, size: 16, delay: 0 },
  { x: 22, y: 34, size: 11, delay: 1.1 },
  { x: 12, y: 62, size: 19, delay: 0.5 },
  { x: 26, y: 84, size: 13, delay: 1.7 },
  { x: 40, y: 8, size: 10, delay: 2.2 },
  { x: 58, y: 90, size: 14, delay: 0.8 },
  { x: 74, y: 76, size: 11, delay: 1.4 },
  { x: 88, y: 88, size: 18, delay: 0.3 },
  { x: 92, y: 56, size: 13, delay: 2 },
  { x: 84, y: 14, size: 14, delay: 1.2 },
  { x: 64, y: 6, size: 11, delay: 2.6 },
  { x: 6, y: 40, size: 10, delay: 2.9 },
];

function Sparkle({
  x,
  y,
  size,
  dx,
  dy,
  delay,
  gold,
}: (typeof SPARKLES)[number]) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      className={clsx(
        "absolute animate-ai-sparkle",
        gold ? "text-amber-400" : "text-[#9a6cf5] dark:text-dprimary",
      )}
      style={
        {
          left: `${x}%`,
          top: `${y}%`,
          animationDelay: `${delay}s`,
          "--dx": `${dx}px`,
          "--dy": `${dy}px`,
        } as React.CSSProperties
      }
    >
      <path d={STAR_PATH} fill="currentColor" />
    </svg>
  );
}

function Wand() {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className="absolute inset-0 size-full animate-ai-wand origin-[22%_82%] drop-shadow-[0_10px_18px_rgba(124,77,219,0.45)]"
    >
      <defs>
        <linearGradient id="ai-wand-stick" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#2a2340" />
          <stop offset="1" stopColor="#4b3a7a" />
        </linearGradient>
        <radialGradient id="ai-wand-glow">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0.95" />
          <stop offset="0.45" stopColor="#c4b5fd" stopOpacity="0.55" />
          <stop offset="1" stopColor="#9a6cf5" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* stick */}
      <line
        x1="22"
        y1="82"
        x2="62"
        y2="38"
        stroke="url(#ai-wand-stick)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* white band below the tip */}
      <line
        x1="55"
        y1="45.7"
        x2="60.2"
        y2="40"
        stroke="#f5f3ff"
        strokeWidth="7.4"
      />
      {/* glowing star tip */}
      <circle
        cx="70"
        cy="28"
        r="20"
        fill="url(#ai-wand-glow)"
        className="animate-ai-glow origin-[70%_28%]"
      />
      <g transform="translate(59 17) scale(0.92)">
        <path
          d={STAR_PATH}
          fill="#fbbf24"
          className="animate-ai-tip origin-center [transform-box:fill-box]"
        />
      </g>
    </svg>
  );
}

/**
 * Covers the AI quiz modal while a quiz is being generated: a waving magic
 * wand throwing sparkles, a glowing ring running round the modal edge and a
 * rotating status line. Mount it only while the request is in flight.
 */
export default function AiMagicLoader({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => Math.min(i + 1, MESSAGES.length - 1)),
      MESSAGE_MS,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        "absolute inset-0 z-10 overflow-hidden flex flex-col items-center justify-center gap-6 px-6 text-center",
        "bg-white/85 dark:bg-dark/85 backdrop-blur-[6px] animate-fade-in",
        className,
      )}
    >
      {/* glowing ring that runs round the modal edge */}
      <span
        aria-hidden
        className="ai-magic-ring pointer-events-none absolute inset-0 rounded-[inherit]"
      />
      {AMBIENT.map((a, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          width={a.size}
          height={a.size}
          aria-hidden
          className={clsx(
            "pointer-events-none absolute animate-ai-twinkle",
            i % 3 === 0
              ? "text-amber-400"
              : "text-[#9a6cf5] dark:text-dprimary",
          )}
          style={{
            left: `${a.x}%`,
            top: `${a.y}%`,
            animationDelay: `${a.delay}s`,
          }}
        >
          <path d={STAR_PATH} fill="currentColor" />
        </svg>
      ))}
      {/* soft aurora behind the wand */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-[62%] rounded-full bg-[radial-gradient(circle,rgba(154,108,245,0.28),transparent_62%)] animate-ai-glow"
      />

      <div className="relative size-44 animate-float">
        <Wand />
        {SPARKLES.map((s, i) => (
          <Sparkle key={i} {...s} />
        ))}
      </div>

      <div className="relative flex flex-col items-center gap-2 max-w-sm">
        <p className="text-lg md:text-xl font-bold tracking-[-0.01em]">
          Conjuring{" "}
          <span className="bg-linear-to-r from-[#9a6cf5] via-[#c084fc] to-[#7c4ddb] dark:from-dprimary dark:via-[#e9d5ff] dark:to-dprimary bg-clip-text text-transparent bg-[length:200%_100%] animate-ai-shimmer-text">
            {title.trim() || "your quiz"}
          </span>
        </p>
        <p
          key={index}
          className={clsx("text-sm animate-fade-up-fast", mutedText)}
        >
          {MESSAGES[index]}
        </p>
      </div>

      <div className="relative h-1.5 w-56 overflow-hidden rounded-full bg-lprimary/10 dark:bg-white/10">
        <span className="absolute inset-y-0 w-1/3 rounded-full bg-linear-to-r from-transparent via-[#9a6cf5] to-transparent dark:via-dprimary animate-ai-progress" />
      </div>
    </div>
  );
}
