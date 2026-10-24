"use client";

import type { ReactNode } from "react";
import ClientImage from "@/components/ClientImage";
import ConnectionStatusPill from "@/components/ConnectionStatusPill";
import EndQuizButton from "@/components/Admin/EndQuizButton";

/** The look of the "Live" pill, shared by the header's controls. */
export const headerPillClass =
  "inline-flex items-center gap-2 rounded-full border border-lprimary/15 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-[13px] font-semibold text-dark dark:text-white";

/** Live status and "End quiz", as pills. */
export function HostControls({
  roomId,
  endRedirect,
  alreadyEnded,
  className,
}: {
  roomId: string;
  endRedirect?: string;
  alreadyEnded?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap justify-end items-center gap-2 shrink-0 ${className ?? ""}`}
    >
      <ConnectionStatusPill className={`!shadow-none ${headerPillClass}`} />
      <EndQuizButton
        pill
        roomId={roomId}
        alreadyEnded={alreadyEnded}
        {...(endRedirect ? { redirectTo: endRedirect } : {})}
      />
    </div>
  );
}

/**
 * Host waiting room / game header: the logo on the left, the quiz name next
 * to it (vertically centred), and at the very top right the Live status
 * and "End quiz" — both as pills.
 */
export default function HostHeader({
  title,
  roomId,
  endRedirect,
  alreadyEnded,
  middle,
  controlsBelowOnPhone = false,
}: {
  title: string;
  roomId: string;
  endRedirect?: string;
  alreadyEnded?: boolean;
  /** Extra info between the title and the controls (progress, room code). */
  middle?: ReactNode;
  /** Phones: the controls are left out here — the page shows
   *  `HostControls` at its end instead (the game needs the room). */
  controlsBelowOnPhone?: boolean;
}) {
  return (
    <header className="flex items-center gap-3 md:gap-5 pt-3 pb-2 md:pt-4 md:pb-3 shrink-0">
      <div className="flex-1 min-w-0 flex items-center gap-3 md:gap-5">
        <ClientImage
          props={{
            src: "/images/logo.svg",
            darksrc: "/images/logo-dark.svg",
            alt: "Logo",
            width: 64,
            height: 64,
          }}
        />
        <h1 className="flex-1 min-w-0 text-xl md:text-2xl font-bold tracking-[-0.01em] truncate">
          {title}
        </h1>
        {middle && (
          <div className="shrink-0 flex items-center gap-2">{middle}</div>
        )}
      </div>
      <HostControls
        roomId={roomId}
        endRedirect={endRedirect}
        alreadyEnded={alreadyEnded}
        className={controlsBelowOnPhone ? "hidden md:flex" : undefined}
      />
    </header>
  );
}
