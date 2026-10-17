"use client";

import type { ReactNode } from "react";
import GameLogo from "@/components/Game/GameLogo";
import ConnectionStatusPill from "@/components/ConnectionStatusPill";
import EndQuizButton from "@/components/Admin/EndQuizButton";
import { SoundToggle } from "@/lib/sound/director";

/** The look of the "Live" pill, shared by the header's controls. */
export const headerPillClass =
  "inline-flex items-center gap-2 rounded-full border border-lprimary/15 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-[13px] font-semibold text-dark dark:text-white";

/**
 * Host waiting room / game header: the logo on the left, the quiz name next
 * to it (vertically centred), and at the very top right the Live status,
 * the sound switch and "End quiz" — all three as pills.
 */
export default function HostHeader({
  title,
  roomId,
  endRedirect,
  alreadyEnded,
  middle,
  logo,
}: {
  title: string;
  /** The quiz's own logo (replaces the site logo). */
  logo?: string | null;
  roomId: string;
  endRedirect?: string;
  alreadyEnded?: boolean;
  /** Extra info between the title and the controls (progress, room code). */
  middle?: ReactNode;
}) {
  return (
    <header className="flex items-start gap-3 md:gap-5 pt-3 pb-2 md:pt-4 md:pb-3 shrink-0">
      <div className="flex-1 min-w-0 flex items-center gap-3 md:gap-5 self-center">
        <GameLogo logo={logo} size={64} />
        <h1 className="flex-1 min-w-0 text-xl md:text-2xl font-bold tracking-[-0.01em] truncate">
          {title}
        </h1>
        {middle}
      </div>
      <div className="flex flex-wrap justify-end items-center gap-2 shrink-0">
        <ConnectionStatusPill className={`!shadow-none ${headerPillClass}`} />
        <SoundToggle pill />
        <EndQuizButton
          pill
          roomId={roomId}
          alreadyEnded={alreadyEnded}
          {...(endRedirect ? { redirectTo: endRedirect } : {})}
        />
      </div>
    </header>
  );
}
