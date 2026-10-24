"use client";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { HEARTBEAT_INTERVAL_MS } from "@buzrr/contract";
import { useAppDispatch } from "@/state/hooks";
import {
  answerResult,
  answerCount,
  liveSummary,
  applySync,
  gameOver,
  gameStarted,
  phaseChange,
  preloadHint,
  reactionBudgetKnown,
  lobbyAssetsKnown,
  closedSummaryReceived,
  leaderboardReceived,
  playerConnection,
  playerRemoved,
  questionEnd,
  questionStart,
  resetGame,
  setConnection,
} from "@/state/game/gameSlice";
import type { GameSocket } from "@/types/socket";
import {
  onAssetsProgress,
  onPreloadProgress,
  setSlotChannel,
} from "@/lib/sound/preload";

export interface UseGameSocketOptions {
  userType: "admin" | "player" | "duel";
  gameCode: string;
  /** Player/account JWT; admins can also authenticate via session cookie. */
  token?: string;
  /** Defer connecting until credentials are resolved (default true). */
  ready?: boolean;
  /** Called once per socket instance, to attach role-specific listeners. */
  bind?: (socket: GameSocket) => void;
}

/**
 * Re-syncs a page coming back to the foreground. Phones suspend background
 * tabs, and a suspended socket can still look connected for a ping timeout
 * after the server dropped it — every event in between is lost, and with no
 * reconnect there is no `state-sync` to repair the screen. Asking for one on
 * return covers that; on a socket that is in fact dead the emit fails, the
 * client reconnects, and the connect-time snapshot does the same job. A
 * disconnected socket is left to the manager: one the server refused must
 * not be reconnected from here.
 */
export function resyncOnReturn(
  conn: Pick<GameSocket, "connected" | "emit">,
  visibility: DocumentVisibilityState,
): void {
  if (visibility === "visible" && conn.connected) conn.emit("request-sync");
}

/**
 * Owns the socket lifecycle and mirrors all server-pushed game state into the
 * `game` slice. The server sends a full `state-sync` on every (re)connection,
 * so reconnects need no client-side bookkeeping — the whole screen re-renders
 * from the fresh snapshot.
 */
/** How long the server gets to answer `preload-slot`. */
const SLOT_ACK_MS = 10_000;
/** A queued device starts anyway after this long (the countdown has moved on by then). */
const SLOT_GIVE_UP_MS = 90_000;

export function useGameSocket({
  userType,
  gameCode,
  token,
  ready = true,
  bind,
}: UseGameSocketOptions): { socket: GameSocket | null } {
  const dispatch = useAppDispatch();
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const bindRef = useRef(bind);
  useEffect(() => {
    bindRef.current = bind;
  }, [bind]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!ready) return;
    if ((userType === "player" || userType === "duel") && !token) return;

    const conn: GameSocket = io(
      `${process.env.NEXT_PUBLIC_SOCKET_URL}/?userType=${userType}&gameCode=${encodeURIComponent(gameCode)}`,
      {
        withCredentials: true,
        ...(token ? { auth: { token } } : {}),
      },
    );

    dispatch(resetGame());
    dispatch(setConnection("connecting"));

    // Players' devices prove they are still here (see HEARTBEAT_TIMEOUT_MS):
    // a page that stops beating is dropped, and in the lobby leaves the list.
    const beat = () => {
      if (userType === "player" && conn.connected) conn.emit("heartbeat");
    };
    const heartbeat = setInterval(beat, HEARTBEAT_INTERVAL_MS);

    conn.on("connect", () => {
      dispatch(setConnection("connected"));
      beat();
      // The server pushes state-sync on connect; this is only a safety net
      // for proxies that drop the initial burst.
      conn.emit("request-sync");
    });
    conn.on("disconnect", (reason) => {
      // "io server disconnect" means the server refused this socket (auth or
      // validation failure) — the client will NOT retry on its own, so show a
      // hard "disconnected" instead of a perpetual "reconnecting".
      dispatch(
        setConnection(
          reason === "io server disconnect" ? "disconnected" : "reconnecting",
        ),
      );
    });
    // The Manager (conn.io) is shared across sockets for the same URL, so
    // this handler must be removed explicitly on cleanup.
    const onReconnectFailed = () => {
      dispatch(setConnection("disconnected"));
    };
    conn.io.on("reconnect_failed", onReconnectFailed);
    const onVisibilityChange = () => {
      resyncOnReturn(conn, document.visibilityState);
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    conn.on("connect_error", () => {
      // The manager keeps retrying with backoff, so this is transient.
      dispatch(setConnection("reconnecting"));
    });

    conn.on("state-sync", (payload) => dispatch(applySync(payload)));
    conn.on("game-started", (payload) => dispatch(gameStarted(payload)));
    conn.on("phase-change", (payload) => dispatch(phaseChange(payload)));
    conn.on("preload", (payload) => dispatch(preloadHint(payload)));
    conn.on("preload-all", (p) => dispatch(lobbyAssetsKnown(p)));
    // Lobby downloads: progress at most every second, "done" always.
    let lastAssets = 0;
    const offAssets = onAssetsProgress((r) => {
      const now = Date.now();
      if (!r.done && now - lastAssets < 1000) return;
      lastAssets = now;
      if (conn.connected) conn.emit("assets-status", r);
    });
    // The reaction budget (and the room's size) — kept in the store, so a
    // reaction bar mounted later (the final standings') still knows it.
    conn.on("reaction-limit", (p) => dispatch(reactionBudgetKnown(p)));
    conn.on("closed-summary", (payload) =>
      dispatch(closedSummaryReceived(payload)),
    );
    // Report downloads of the next question's sound (throttled; "done" always).
    let lastReport = 0;
    const offProgress = onPreloadProgress((r) => {
      const now = Date.now();
      if (!r.done && now - lastReport < 400) return;
      lastReport = now;
      if (conn.connected) conn.emit("preload-status", r);
    });
    // Download slots: ask the server before fetching a question's sound or
    // the skin's files; a queued device waits for `preload-go` (asking again
    // after a reconnect). No answer (an older server) or no turn within
    // SLOT_GIVE_UP_MS: go. The host never queues: its screen plays every
    // song, so it fetches them all at once.
    setSlotChannel(
      userType === "admin"
        ? null
        : {
            keepAlive: (kind, qIndex) => {
              // Asking again while holding the slot just refreshes it.
              if (conn.connected) {
                conn
                  .timeout(SLOT_ACK_MS)
                  .emit("preload-slot", { qIndex, kind }, () => undefined);
              }
            },
            done: (kind, qIndex) => {
              if (conn.connected) conn.emit("slot-done", { qIndex, kind });
            },
            wait: (kind, qIndex) =>
              new Promise((resolve) => {
                let settled = false;
                const finish = (limited: boolean) => {
                  if (settled) return;
                  settled = true;
                  clearTimeout(giveUp);
                  conn.off("preload-go", onGo);
                  conn.off("connect", ask);
                  resolve({ limited });
                };
                const onGo = (p: { qIndex: number; kind?: string }) => {
                  if (p.qIndex === qIndex && (p.kind ?? "question") === kind) {
                    finish(true);
                  }
                };
                const ask = () =>
                  conn
                    .timeout(SLOT_ACK_MS)
                    .emit("preload-slot", { qIndex, kind }, (err, res) => {
                      if (err) finish(false);
                      else if (res.go) finish(res.limited);
                    });
                const giveUp = setTimeout(() => finish(true), SLOT_GIVE_UP_MS);
                conn.on("preload-go", onGo);
                conn.on("connect", ask);
                if (conn.connected) ask();
              }),
          },
    );

    conn.on("question-start", (payload) => dispatch(questionStart(payload)));
    conn.on("question-end", (payload) => dispatch(questionEnd(payload)));
    conn.on("answer-result", (payload) => dispatch(answerResult(payload)));
    conn.on("answer-count", (payload) => dispatch(answerCount(payload)));
    conn.on("live-summary", (payload) => dispatch(liveSummary(payload)));
    conn.on("leaderboard", (payload) => dispatch(leaderboardReceived(payload)));
    conn.on("game-over", (payload) =>
      dispatch(
        gameOver({
          entries: payload.entries,
          eloChanges: payload.eloChanges,
          rated: payload.rated,
          category: payload.category,
          streaks: payload.streaks,
        }),
      ),
    );
    conn.on("player-connection", (payload) =>
      dispatch(playerConnection(payload)),
    );
    conn.on("player-removed", (player) =>
      dispatch(playerRemoved({ playerId: player.id })),
    );
    conn.on("player-left", (player) =>
      dispatch(playerRemoved({ playerId: player.id })),
    );

    bindRef.current?.(conn);
    setSocket(conn);

    return () => {
      clearInterval(heartbeat);
      offProgress();
      offAssets();
      setSlotChannel(null);
      conn.io.off("reconnect_failed", onReconnectFailed);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      conn.disconnect();
      setSocket(null);
      dispatch(resetGame());
    };
  }, [dispatch, userType, gameCode, token, ready]);

  return { socket };
}
