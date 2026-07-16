"use client";

import dynamic from "next/dynamic";

// Lazy-load to keep react-countdown-circle-timer out of the main bundle.
const CountdownCircleTimer = dynamic(
  () =>
    import("react-countdown-circle-timer").then((m) => ({
      default: m.CountdownCircleTimer,
    })),
  { ssr: false },
);

/**
 * Animated question countdown shared by the admin and player screens. It is
 * display-only — the server ends the question at its own deadline; remount
 * (key by question id) when a new question starts.
 */
export default function CountdownRing(params: {
  duration: number;
  remaining: number;
  size?: number;
}) {
  return (
    <CountdownCircleTimer
      isPlaying
      duration={params.duration}
      initialRemainingTime={Math.min(params.remaining, params.duration)}
      colors={["#a589fc", "#F7B801", "#A30000"]}
      // Warning threshold scales with short questions so it never exceeds
      // the duration (which would skip the first color entirely).
      colorsTime={[params.duration, Math.min(5, params.duration / 2), 0]}
      size={params.size ?? 150}
      updateInterval={1}
    >
      {({ remainingTime }: { remainingTime: number }) => (
        <span className="text-2xl font-bold dark:text-white">
          {remainingTime}
        </span>
      )}
    </CountdownCircleTimer>
  );
}
