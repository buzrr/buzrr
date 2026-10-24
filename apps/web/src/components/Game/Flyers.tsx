"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import clsx from "clsx";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import { LuPlus } from "react-icons/lu";
import { toast } from "react-toastify";
import modalStyle from "@/utils/modalStyle";
import type { GameSocket } from "@/types/socket";
import { useAppSelector } from "@/state/hooks";
import {
  BASE_REACTION_EMOJIS,
  MAX_CUSTOM_REACTIONS,
  REACTION_EMOJI_CHOICES,
  loadCustomReactions,
  saveCustomReactions,
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
const PODIUM_EVENT = "buzrr:podium-emoji";

/** An emoji rising from a winner's avatar on the final podium (host). */
export function podiumEmoji(playerId: string, emoji: string) {
  window.dispatchEvent(
    new CustomEvent(PODIUM_EVENT, { detail: { playerId, emoji } }),
  );
}

/** A player's avatar on the final podium, if it is on screen. */
function podiumAvatar(playerId: string): DOMRect | null {
  const el = document.querySelector(
    `[data-podium-player="${CSS.escape(playerId)}"]`,
  );
  return el ? el.getBoundingClientRect() : null;
}

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
      // The final top three: their emojis fly off their heads.
      const head = podiumAvatar(r.playerId);
      if (head) {
        spawn({
          emoji: r.emoji,
          x:
            head.left +
            head.width / 2 +
            (Math.random() - 0.5) * head.width * 0.4,
          y: head.top,
          dx: (Math.random() - 0.5) * 160,
          rise: Math.max(160, head.top * (0.8 + Math.random() * 0.2)),
          size: 34 + Math.random() * 14,
          duration: 2200 + Math.random() * 1200,
        });
        return;
      }
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
    const onPodium = (e: Event) =>
      onReaction(
        (e as CustomEvent<{ playerId: string; emoji: string }>).detail,
      );
    socket.on("reaction", onReaction);
    window.addEventListener(PODIUM_EVENT, onPodium);
    return () => {
      socket.off("reaction", onReaction);
      window.removeEventListener(PODIUM_EVENT, onPodium);
    };
  }, [socket, spawn]);
  return <>{layer}</>;
}

const LONG_PRESS_MS = 500;

/**
 * Tap sends, a long press does something else (change the emoji). Pointer
 * based, so it works the same with touch and mouse.
 */
function useTapOrLongPress(onTap: () => void, onLong: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const long = useRef(false);
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: () => {
      long.current = false;
      clear();
      timer.current = setTimeout(() => {
        long.current = true;
        onLong();
      }, LONG_PRESS_MS);
    },
    onPointerUp: () => {
      clear();
      if (!long.current) onTap();
    },
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };
}

function ReactionButton({
  emoji,
  onSend,
  onLongPress,
}: {
  emoji: string;
  onSend: (emoji: string, el: HTMLElement) => void;
  onLongPress: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const handlers = useTapOrLongPress(
    () => ref.current && onSend(emoji, ref.current),
    onLongPress,
  );
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`Send ${emoji}`}
      {...handlers}
      className="size-10 rounded-full text-xl flex items-center justify-center cursor-pointer select-none active:scale-90 transition-transform hover:bg-lprimary/10 dark:hover:bg-white/10 touch-manipulation [-webkit-touch-callout:none]"
    >
      {emoji}
    </button>
  );
}

/**
 * Player screens: the reaction buttons (each tap = one reaction). The three
 * base reactions are fixed; a "+" slot adds own ones (up to four, so seven
 * in all), and a long press on an own one changes or removes it. Own ones
 * are remembered in localStorage. `inline` lays them out in a row in the
 * page flow (lobby, under the bubble field); otherwise they float at the
 * screen edge — a row along the bottom on phones.
 */
export function ReactionBar({
  socket,
  inline = false,
  oneShot = false,
  onSent,
  blink = false,
  hint,
}: {
  socket: GameSocket | null;
  inline?: boolean;
  /**
   * One emoji for the player's row on the host's board (a right answer at
   * the reveal, the scores step's top players), then the bar goes.
   */
  oneShot?: boolean;
  onSent?: () => void;
  /** Catch the eye (the final standings' top). */
  blink?: boolean;
  /** A call to send, shown beside the bar (the podium). */
  hint?: string;
}) {
  const [shot, setShot] = useState(false);
  const { spawn, layer } = useFlyers();
  const [custom, setCustom] = useState<string[]>([]);
  // null = closed; "add" = new slot; number = editing that own reaction.
  const [editing, setEditing] = useState<"add" | number | null>(null);
  // localStorage isn't readable during SSR; pick up the saved set on mount.
  useEffect(() => setCustom(loadCustomReactions()), []);

  // Same budget as the server (it sends the room's limit, and starts it
  // afresh with every question): after that the buttons rest until the
  // oldest tap drops out of the window; a tap then says so.
  const taps = useRef<number[]>([]);
  // The server's budget, from the store (0 = no limit: the final top three).
  const budget = useAppSelector((st) => st.game.reactionBudget);
  const limit = budget.limit > 0 ? budget.limit : Infinity;
  const windowMs = budget.windowMs;
  const [blockedUntil, setBlockedUntil] = useState(0);
  // A fresh start (every question, the final standings): count anew — the
  // pause ends now, the taps are dropped with the next one.
  const tapsSeq = useRef(budget.resetSeq);
  const [seenReset, setSeenReset] = useState(budget.resetSeq);
  if (seenReset !== budget.resetSeq) {
    setSeenReset(budget.resetSeq);
    setBlockedUntil(0);
  }
  const limitReached = () =>
    toast.info("Limit reached — wait a little.", {
      toastId: "reaction-limit",
      autoClose: 2500,
    });
  useEffect(() => {
    if (!socket) return;
    // A winner (no limit from now on) is told once the host's podium
    // stands — the bar's "share your emojis" hint — not early.
    const onLimited = ({ retryInMs }: { retryInMs: number }) => {
      setBlockedUntil(Date.now() + retryInMs);
      limitReached();
    };
    socket.on("reaction-limited", onLimited);
    return () => {
      socket.off("reaction-limited", onLimited);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);
  // Seconds left of the pause (updated by a timer, not read during render).
  const [blockedFor, setBlockedFor] = useState(0);
  useEffect(() => {
    if (!blockedUntil) return;
    const tick = () => {
      const left = Math.ceil((blockedUntil - Date.now()) / 1000);
      if (left <= 0) {
        setBlockedUntil(0);
        setBlockedFor(0);
      } else setBlockedFor(left);
    };
    tick();
    const tm = setInterval(tick, 500);
    return () => clearInterval(tm);
  }, [blockedUntil]);

  const send = (emoji: string, el: HTMLElement) => {
    const now = Date.now();
    if (tapsSeq.current !== budget.resetSeq) {
      tapsSeq.current = budget.resetSeq;
      taps.current = [];
    }
    taps.current = taps.current.filter((at) => now - at < windowMs);
    if (
      limit !== Infinity &&
      (now < blockedUntil || taps.current.length >= limit)
    ) {
      limitReached();
      return;
    }
    taps.current.push(now);
    if (taps.current.length >= limit) {
      setBlockedUntil(taps.current[0]! + windowMs);
    }
    if (socket?.connected) {
      socket.emit("reaction", oneShot ? { emoji, board: true } : { emoji });
    }
    if (oneShot) {
      setShot(true);
      onSent?.();
    }
    const r = el.getBoundingClientRect();
    spawn({
      emoji,
      x: r.left + r.width / 2,
      y: r.top,
      ...tapJitter(),
      size: 26,
      duration: 1100,
    });
  };

  const update = (next: string[]) => {
    setCustom(next);
    saveCustomReactions(next);
  };

  // Sent: the flyer finishes, the bar is gone.
  if (shot) return <>{layer}</>;

  return (
    <>
      {hint && !inline && (
        <div className="fixed z-40 bottom-[7.25rem] left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-16 md:bottom-16 rounded-full bg-lprimary dark:bg-dprimary px-3.5 py-1.5 text-sm font-bold text-white dark:text-dark shadow-lg animate-bounce whitespace-nowrap pointer-events-none">
          {hint}
        </div>
      )}
      <div
        className={clsx(
          "flex gap-1 rounded-full bg-white/85 dark:bg-dark/85 p-1.5 border border-lprimary/15 dark:border-white/10",
          inline
            ? "mx-auto mt-2 w-fit max-w-full flex-row flex-wrap justify-center"
            : "fixed z-40 shadow-lg backdrop-blur flex-row bottom-14 left-1/2 -translate-x-1/2 md:flex-col md:left-auto md:translate-x-0 md:right-2 md:bottom-14",
          // Faded, but a tap still says why nothing happens.
          blockedFor > 0 && "opacity-45",
          blink && blockedFor === 0 && "animate-bar-blink",
        )}
      >
        {BASE_REACTION_EMOJIS.map((emoji) => (
          <ReactionButton
            key={emoji}
            emoji={emoji}
            onSend={send}
            onLongPress={() => toast.info("Base smileys cannot be changed")}
          />
        ))}
        {custom.map((emoji, i) => (
          <ReactionButton
            key={`${emoji}-${i}`}
            emoji={emoji}
            onSend={send}
            onLongPress={() => setEditing(i)}
          />
        ))}
        {custom.length < MAX_CUSTOM_REACTIONS && (
          <button
            type="button"
            aria-label="Add a reaction"
            onClick={() => setEditing("add")}
            className="size-10 rounded-full flex items-center justify-center cursor-pointer border-2 border-dashed border-lprimary/30 dark:border-white/20 text-off-dark dark:text-muted-dark hover:bg-lprimary/10 dark:hover:bg-white/10"
          >
            <LuPlus size={16} />
          </button>
        )}
      </div>
      {blockedFor > 0 && (
        <p
          className={clsx(
            "text-center text-xs font-medium text-off-dark dark:text-muted-dark",
            !inline && "fixed z-40 bottom-[7.5rem] left-1/2 -translate-x-1/2",
          )}
        >
          Reactions again in {blockedFor} s
        </p>
      )}
      <EmojiPicker
        open={editing !== null}
        current={typeof editing === "number" ? custom[editing] : undefined}
        taken={[...BASE_REACTION_EMOJIS, ...custom]}
        onClose={() => setEditing(null)}
        onPick={(emoji) => {
          if (editing === "add") update([...custom, emoji]);
          else if (typeof editing === "number")
            update(custom.map((e, i) => (i === editing ? emoji : e)));
          setEditing(null);
        }}
        onRemove={
          typeof editing === "number"
            ? () => {
                update(custom.filter((_, i) => i !== editing));
                setEditing(null);
              }
            : undefined
        }
      />
      {layer}
    </>
  );
}

/** Pick one emoji for an own reaction slot (tap = done). */
function EmojiPicker({
  open,
  current,
  taken,
  onClose,
  onPick,
  onRemove,
}: {
  open: boolean;
  current?: string;
  /** Already on the bar (shown greyed out, except the one being changed). */
  taken: string[];
  onClose: () => void;
  onPick: (emoji: string) => void;
  onRemove?: () => void;
}) {
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
          {current ? "Change your reaction" : "Add a reaction"}
        </h2>
        <div className="mt-4 grid grid-cols-8 gap-1">
          {REACTION_EMOJI_CHOICES.map((emoji) => {
            const isCurrent = emoji === current;
            const used = !isCurrent && taken.includes(emoji);
            return (
              <button
                key={emoji}
                type="button"
                disabled={used}
                onClick={() => onPick(emoji)}
                aria-pressed={isCurrent}
                className={clsx(
                  "aspect-square rounded-xl text-2xl flex items-center justify-center cursor-pointer disabled:opacity-25 disabled:cursor-default",
                  isCurrent
                    ? "bg-lprimary/20 dark:bg-dprimary/25 ring-2 ring-lprimary dark:ring-dprimary"
                    : "hover:bg-lprimary/10 dark:hover:bg-white/10",
                )}
              >
                {emoji}
              </button>
            );
          })}
        </div>
        <div className="mt-5 flex gap-2 justify-end">
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="mr-auto px-4 py-2 rounded-xl font-bold text-red-light dark:text-red-dark hover:bg-red-light/10 cursor-pointer"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl font-bold text-dark dark:text-white hover:bg-card-light dark:hover:bg-card-dark cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </Box>
    </Modal>
  );
}
