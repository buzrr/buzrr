"use client";

import clsx from "clsx";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { REACTION_EMOJIS, type ReactionEmoji } from "@buzrr/contract";
import type { GameSocket } from "@/types/socket";

/** How long one reaction stays on screen; matches `reaction-rise`. */
const FLOAT_MS = 2_600;
/** On-screen cap, so a burst from a big room stays readable (and cheap). */
const MAX_FLOATING = 30;
/** Same gap the server enforces per socket; faster taps would be dropped. */
const SEND_GAP_MS = 400;

interface Floating {
  id: number;
  emoji: string;
  name?: string;
  /** Horizontal start, % of the layer width. */
  x: number;
  /** Sideways drift on the way up (CSS length). */
  sway: string;
}

/** Reactions currently floating, each removed once its animation is done. */
export function useFloatingReactions() {
  const [items, setItems] = useState<Floating[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const add = useCallback((emoji: string, name?: string) => {
    const id = nextId.current++;
    const item: Floating = {
      id,
      emoji,
      name,
      x: 8 + Math.random() * 84,
      sway: `${Math.round((Math.random() - 0.5) * 80)}px`,
    };
    setItems((list) => [...list.slice(-(MAX_FLOATING - 1)), item]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setItems((list) => list.filter((i) => i.id !== id));
    }, FLOAT_MS);
    timers.current.add(timer);
  }, []);

  return { items, add };
}

/** The floating layer itself: decorative, never in the way of a click. */
export function ReactionLayer({
  items,
  className,
}: {
  items: Floating[];
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={clsx(
        "pointer-events-none fixed inset-0 z-40 overflow-hidden",
        className,
      )}
    >
      {items.map((item) => (
        <span
          key={item.id}
          className="absolute bottom-[6vh] flex flex-col items-center animate-reaction-rise"
          style={
            {
              left: `${item.x}%`,
              "--sway": item.sway,
            } as CSSProperties
          }
        >
          <span className="text-4xl md:text-5xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.25)]">
            {item.emoji}
          </span>
          {item.name && (
            <span className="mt-1 max-w-[120px] truncate rounded-full px-2 py-0.5 text-[11px] font-semibold text-white bg-[rgba(10,8,20,0.55)]">
              {item.name}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/** Host screen: everyone's reactions, as the server relays them. */
export function ReactionOverlay({ socket }: { socket: GameSocket }) {
  const { items, add } = useFloatingReactions();
  useEffect(() => {
    const onReaction = (r: { emoji: string; name: string }) =>
      add(r.emoji, r.name);
    socket.on("reaction", onReaction);
    return () => {
      socket.off("reaction", onReaction);
    };
  }, [socket, add]);
  return <ReactionLayer items={items} />;
}

/**
 * Player screen: the emoji tray. A tap goes to the host (best effort, no
 * ack) and floats here for the sender only.
 */
export function ReactionBar({ socket }: { socket: GameSocket }) {
  const { items, add } = useFloatingReactions();
  const [cooling, setCooling] = useState(false);
  const coolTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(coolTimer.current), []);

  const send = (emoji: ReactionEmoji) => {
    if (cooling) return;
    socket.emit("send-reaction", { emoji });
    add(emoji);
    setCooling(true);
    coolTimer.current = setTimeout(() => setCooling(false), SEND_GAP_MS);
  };

  return (
    <>
      <ReactionLayer items={items} />
      <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(12px,env(safe-area-inset-bottom))] pointer-events-none">
        <div
          role="group"
          aria-label="Send a reaction"
          className="pointer-events-auto flex gap-1 rounded-full border p-1.5 bg-white/90 dark:bg-dark/90 backdrop-blur border-lprimary/15 dark:border-white/10 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.35)] animate-fade-up-fast"
        >
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => send(emoji)}
              aria-label={`React ${emoji}`}
              className={clsx(
                "size-11 rounded-full text-2xl flex items-center justify-center cursor-pointer transition-[transform,background-color] hover:bg-lprimary/8 dark:hover:bg-white/5 active:scale-90",
                cooling && "opacity-60",
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
