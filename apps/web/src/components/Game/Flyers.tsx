"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { ReactionKind } from "@buzrr/contract";
import type { GameSocket } from "@/types/socket";

/**
 * Emojis that float up the screen and fade out: reactions on the host's
 * screens and the bubbles players pop in the lobby. Each flyer animates
 * itself with the Web Animations API and is removed when done.
 */

export const REACTION_EMOJI: Record<ReactionKind, string> = {
  thumbs: "👍",
  heart: "❤️",
  laugh: "😂",
};

interface Flyer {
  id: number;
  emoji: string;
  x: number;
  y: number;
  /** Total horizontal drift and rise, px. */
  dx: number;
  rise: number;
  size: number;
  duration: number;
  label?: string;
}

const MAX_FLYERS = 160;

function FlyerItem({ f, onDone }: { f: Flyer; onDone: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anim = el.animate(
      [
        { transform: "translate(-50%, 0) scale(0.4)", opacity: 0 },
        { transform: `translate(calc(-50% + ${f.dx * 0.3}px), ${-f.rise * 0.15}px) scale(1.1)`, opacity: 1, offset: 0.12 },
        { transform: `translate(calc(-50% + ${-f.dx * 0.4}px), ${-f.rise * 0.6}px) scale(1)`, opacity: 0.9, offset: 0.6 },
        { transform: `translate(calc(-50% + ${f.dx}px), ${-f.rise}px) scale(0.9)`, opacity: 0 },
      ],
      { duration: f.duration, easing: "cubic-bezier(.2,.6,.4,1)", fill: "forwards" },
    );
    anim.onfinish = () => onDone(f.id);
    return () => anim.cancel();
  }, [f, onDone]);
  return (
    <div
      ref={ref}
      className="absolute flex flex-col items-center select-none"
      style={{ left: f.x, top: f.y, fontSize: f.size, lineHeight: 1 }}
    >
      <span>{f.emoji}</span>
      {f.label && (
        <span className="mt-0.5 max-w-[110px] truncate rounded-full bg-white/80 dark:bg-dark/80 px-1.5 text-[10px] font-semibold text-dark dark:text-white">
          {f.label}
        </span>
      )}
    </div>
  );
}

/** `spawn` adds a flyer at viewport coordinates; render `layer` once. */
export function useFlyers(): {
  spawn: (f: Omit<Flyer, "id">) => void;
  layer: ReactNode;
} {
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const nextId = useRef(0);
  const spawn = useCallback((f: Omit<Flyer, "id">) => {
    setFlyers((prev) => {
      const next = [...prev, { ...f, id: nextId.current++ }];
      return next.length > MAX_FLYERS ? next.slice(-MAX_FLYERS) : next;
    });
  }, []);
  const done = useCallback(
    (id: number) => setFlyers((prev) => prev.filter((x) => x.id !== id)),
    [],
  );
  const layer = (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {flyers.map((f) => (
        <FlyerItem key={f.id} f={f} onDone={done} />
      ))}
    </div>
  );
  return { spawn, layer };
}

/**
 * Host screens: every reaction a player taps floats up the right-hand side,
 * with the player's name (`nameOf`) under it.
 */
export function ReactionOverlay({
  socket,
  nameOf,
}: {
  socket: GameSocket | null;
  nameOf?: (playerId: string) => string | undefined;
}) {
  const { spawn, layer } = useFlyers();
  const nameRef = useRef(nameOf);
  nameRef.current = nameOf;
  useEffect(() => {
    if (!socket) return;
    const onReaction = (r: { playerId: string; kind: ReactionKind }) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      spawn({
        emoji: REACTION_EMOJI[r.kind] ?? "❤️",
        x: w - 40 - Math.random() * Math.min(220, w * 0.25),
        y: h - 70,
        dx: (Math.random() - 0.5) * 120,
        rise: h * (0.65 + Math.random() * 0.3),
        size: 34 + Math.random() * 14,
        duration: 2600 + Math.random() * 1400,
        label: nameRef.current?.(r.playerId),
      });
    };
    socket.on("reaction", onReaction);
    return () => {
      socket.off("reaction", onReaction);
    };
  }, [socket, spawn]);
  return <>{layer}</>;
}

/** Player screens: the three reaction buttons (each tap = one reaction). */
export function ReactionBar({ socket }: { socket: GameSocket | null }) {
  const { spawn, layer } = useFlyers();
  const send = (kind: ReactionKind, e: PointerEvent<HTMLButtonElement>) => {
    if (socket?.connected) socket.emit("reaction", { kind });
    const r = e.currentTarget.getBoundingClientRect();
    spawn({
      emoji: REACTION_EMOJI[kind],
      x: r.left + r.width / 2,
      y: r.top,
      dx: (Math.random() - 0.5) * 50,
      rise: 140 + Math.random() * 60,
      size: 26,
      duration: 1100,
    });
  };
  return (
    <>
      <div className="fixed right-2 bottom-16 md:bottom-14 z-40 flex flex-col gap-1.5 rounded-full bg-white/85 dark:bg-dark/85 p-1.5 shadow-lg backdrop-blur border border-lprimary/15 dark:border-white/10">
        {(Object.keys(REACTION_EMOJI) as ReactionKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            aria-label={`Send ${kind}`}
            onPointerDown={(e) => send(kind, e)}
            className="size-10 rounded-full text-xl flex items-center justify-center cursor-pointer active:scale-90 transition-transform hover:bg-lprimary/10 dark:hover:bg-white/10 touch-manipulation"
          >
            {REACTION_EMOJI[kind]}
          </button>
        ))}
      </div>
      {layer}
    </>
  );
}
