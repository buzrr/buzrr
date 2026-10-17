"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import clsx from "clsx";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import { LuPencil } from "react-icons/lu";
import modalStyle from "@/utils/modalStyle";
import type { GameSocket } from "@/types/socket";
import {
  DEFAULT_REACTION_EMOJIS,
  REACTION_EMOJI_CHOICES,
  loadReactionEmojis,
  saveReactionEmojis,
} from "@/lib/player-prefs";

/**
 * Emojis that float up the screen and fade out: reactions on the host's
 * screens and the bubbles players pop in the lobby. Each flyer animates
 * itself with the Web Animations API and is removed when done.
 */

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
        {
          transform: `translate(calc(-50% + ${f.dx * 0.3}px), ${-f.rise * 0.15}px) scale(1.1)`,
          opacity: 1,
          offset: 0.12,
        },
        {
          transform: `translate(calc(-50% + ${-f.dx * 0.4}px), ${-f.rise * 0.6}px) scale(1)`,
          opacity: 0.9,
          offset: 0.6,
        },
        {
          transform: `translate(calc(-50% + ${f.dx}px), ${-f.rise}px) scale(0.9)`,
          opacity: 0,
        },
      ],
      {
        duration: f.duration,
        easing: "cubic-bezier(.2,.6,.4,1)",
        fill: "forwards",
      },
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

/** Random drift and rise for a reaction tapped by the player. */
function tapJitter() {
  return { dx: (Math.random() - 0.5) * 50, rise: 140 + Math.random() * 60 };
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
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
    >
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
  useEffect(() => {
    nameRef.current = nameOf;
  });
  useEffect(() => {
    if (!socket) return;
    const onReaction = (r: { playerId: string; emoji: string }) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      spawn({
        emoji: r.emoji,
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

/**
 * Player screens: the player's three reaction emojis (each tap = one
 * reaction) and a pencil to pick other ones; the choice is remembered in
 * localStorage for the whole game and the next ones. `inline` lays them out
 * in a row in the page flow (lobby, under the bubble field); otherwise they
 * float at the screen edge — a row along the bottom on phones.
 */
export function ReactionBar({
  socket,
  inline = false,
}: {
  socket: GameSocket | null;
  inline?: boolean;
}) {
  const { spawn, layer } = useFlyers();
  const [emojis, setEmojis] = useState<string[]>(DEFAULT_REACTION_EMOJIS);
  const [picking, setPicking] = useState(false);
  // localStorage isn't readable during SSR; pick up the saved set on mount.
  useEffect(() => setEmojis(loadReactionEmojis()), []);

  const send = (emoji: string, e: PointerEvent<HTMLButtonElement>) => {
    if (socket?.connected) socket.emit("reaction", { emoji });
    const r = e.currentTarget.getBoundingClientRect();
    spawn({
      emoji,
      x: r.left + r.width / 2,
      y: r.top,
      ...tapJitter(),
      size: 26,
      duration: 1100,
    });
  };

  return (
    <>
      <div
        className={clsx(
          "flex gap-1.5 rounded-full bg-white/85 dark:bg-dark/85 p-1.5 border border-lprimary/15 dark:border-white/10",
          inline
            ? "mx-auto mt-2 w-fit flex-row"
            : "fixed z-40 shadow-lg backdrop-blur flex-row bottom-14 left-1/2 -translate-x-1/2 md:flex-col md:left-auto md:translate-x-0 md:right-2 md:bottom-14",
        )}
      >
        {emojis.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            aria-label={`Send ${emoji}`}
            onPointerDown={(e) => send(emoji, e)}
            className="size-10 rounded-full text-xl flex items-center justify-center cursor-pointer active:scale-90 transition-transform hover:bg-lprimary/10 dark:hover:bg-white/10 touch-manipulation"
          >
            {emoji}
          </button>
        ))}
        <button
          type="button"
          aria-label="Choose your reaction emojis"
          onClick={() => setPicking(true)}
          className="size-10 rounded-full flex items-center justify-center cursor-pointer text-off-dark dark:text-muted-dark hover:bg-lprimary/10 dark:hover:bg-white/10"
        >
          <LuPencil size={16} />
        </button>
      </div>
      <EmojiPicker
        // Remount on open so the picker starts from the current set.
        key={picking ? "open" : "closed"}
        open={picking}
        current={emojis}
        onClose={() => setPicking(false)}
        onSave={(next) => {
          setEmojis(next);
          saveReactionEmojis(next);
          setPicking(false);
        }}
      />
      {layer}
    </>
  );
}

/** Pick exactly three reaction emojis (tap order = button order). */
function EmojiPicker({
  open,
  current,
  onClose,
  onSave,
}: {
  open: boolean;
  current: string[];
  onClose: () => void;
  onSave: (emojis: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(current);
  const toggle = (emoji: string) =>
    setPicked((prev) =>
      prev.includes(emoji)
        ? prev.filter((x) => x !== emoji)
        : prev.length < 3
          ? [...prev, emoji]
          : [...prev.slice(1), emoji],
    );
  return (
    <Modal open={open} onClose={onClose} aria-labelledby="emoji-picker-title">
      <Box
        sx={modalStyle}
        className="bg-light-bg dark:bg-dark-bg rounded-2xl w-[92vw] max-w-[400px] p-5"
      >
        <h2
          id="emoji-picker-title"
          className="text-lg font-black text-dark dark:text-white text-center"
        >
          Pick your 3 reactions
        </h2>
        <div className="mt-4 grid grid-cols-8 gap-1">
          {REACTION_EMOJI_CHOICES.map((emoji) => {
            const pos = picked.indexOf(emoji);
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => toggle(emoji)}
                aria-pressed={pos >= 0}
                className={clsx(
                  "relative aspect-square rounded-xl text-2xl flex items-center justify-center cursor-pointer",
                  pos >= 0
                    ? "bg-lprimary/20 dark:bg-dprimary/25 ring-2 ring-lprimary dark:ring-dprimary"
                    : "hover:bg-lprimary/10 dark:hover:bg-white/10",
                )}
              >
                {emoji}
                {pos >= 0 && (
                  <span className="absolute -top-1 -right-1 size-4 rounded-full bg-lprimary dark:bg-dprimary text-[10px] font-bold text-white dark:text-dark flex items-center justify-center">
                    {pos + 1}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl font-bold text-dark dark:text-white hover:bg-card-light dark:hover:bg-card-dark cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={picked.length !== 3}
            onClick={() => onSave(picked)}
            className="px-4 py-2 rounded-xl font-bold bg-lprimary dark:bg-dprimary text-white dark:text-dark disabled:opacity-50 cursor-pointer"
          >
            Save
          </button>
        </div>
      </Box>
    </Modal>
  );
}
