"use client";
import { useAppSelector } from "@/state/hooks";
import type { ConnectionStatus } from "@/types/socket-events";

const STATUS: Record<
  ConnectionStatus,
  { label: string; dot: string; pulse: boolean }
> = {
  connecting: { label: "Connecting…", dot: "bg-yellow-500", pulse: true },
  connected: { label: "Live", dot: "bg-green-500", pulse: false },
  reconnecting: { label: "Reconnecting…", dot: "bg-yellow-500", pulse: true },
  disconnected: { label: "Offline", dot: "bg-red-500", pulse: false },
};

/**
 * Small always-visible socket status indicator, complementing
 * ConnectionBanner (which only appears once the connection degrades).
 */
export default function ConnectionStatusPill({
  className = "",
}: {
  className?: string;
}) {
  const connection = useAppSelector((state) => state.game.connection);
  const { label, dot, pulse } = STATUS[connection];

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-2 rounded-full border border-stone-300 dark:border-stone-600 bg-white/90 dark:bg-dark/90 px-3 py-1 text-xs font-bold text-dark dark:text-white shadow-sm ${className}`}
    >
      <span
        className={`h-2 w-2 rounded-full ${dot} ${pulse ? "animate-pulse" : ""}`}
      />
      {label}
    </span>
  );
}
