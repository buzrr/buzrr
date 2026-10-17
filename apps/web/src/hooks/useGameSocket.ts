"use client";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAppDispatch } from "@/state/hooks";
import {
  answerResult,
  answerCount,
  liveSummary,
  applySync,
  gameOver,
  gameStarted,
  phaseChange,
  leaderboardReceived,
  playerConnection,
  playerRemoved,
  questionEnd,
  questionStart,
  resetGame,
  setConnection,
} from "@/state/game/gameSlice";
import type { GameSocket } from "@/types/socket";

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

    conn.on("connect", () => {
      dispatch(setConnection("connected"));
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
    const onVisibilityChange = () =>
      resyncOnReturn(conn, document.visibilityState);
    document.addEventListener("visibilitychange", onVisibilityChange);
    conn.on("connect_error", () => {
      // The manager keeps retrying with backoff, so this is transient.
      dispatch(setConnection("reconnecting"));
    });

    conn.on("state-sync", (payload) => dispatch(applySync(payload)));
    conn.on("game-started", (payload) => dispatch(gameStarted(payload)));
    conn.on("phase-change", (payload) => dispatch(phaseChange(payload)));
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
      conn.io.off("reconnect_failed", onReconnectFailed);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      conn.disconnect();
      setSocket(null);
      dispatch(resetGame());
    };
  }, [dispatch, userType, gameCode, token, ready]);

  return { socket };
}
