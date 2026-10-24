"use client";

import { useState } from "react";

/** Below this (or not a number) the field falls back to FALLBACK_SEC on blur. */
const MIN_SEC = 4;
const FALLBACK_SEC = 25;
const MAX_SEC = 300;

/**
 * Seconds of a test question. Typing is free (no clamping while you type
 * "15"); on leaving the field an invalid value or one under 4 becomes 25.
 */
export function QuestionSecondsInput({
  value,
  onChange,
  className,
  label,
}: {
  value: number;
  onChange: (sec: number) => void;
  className?: string;
  label?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      max={MAX_SEC}
      value={text ?? String(value)}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (Number.isFinite(n) && n >= MIN_SEC) onChange(Math.min(MAX_SEC, n));
      }}
      onBlur={() => {
        const n = Number(text ?? value);
        if (!Number.isFinite(n) || n < MIN_SEC) onChange(FALLBACK_SEC);
        else onChange(Math.min(MAX_SEC, n));
        setText(null);
      }}
      className={className}
    />
  );
}
