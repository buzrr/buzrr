"use client";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAppDispatch } from "@/state/hooks";
import {
  answerResult,
  applySync,
  gameOver,
  gameStarted,
  leaderboardReceived,
  playerConnection,
  questionEnd,
  questionStart,
  resetGame,
  setConnection,
} from "@/state/game/gameSlice";
import type { GameSocket } from "@/types/socket-events";

export interface UseGameSocketOptions {
  userType: "admin" | "player" | "duel";
  gameCode: string;
  /** Player/account JWT; admins can also authenticate via session cookie. */
  token?: string;
  /** Called once per socket instance, to attach role-specific listeners. */
  bind?: (socket: GameSocket) => void;
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
  bind,
}: UseGameSocketOptions): { socket: GameSocket | null } {
  const dispatch = useAppDispatch();
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const bindRef = useRef(bind);
  bindRef.current = bind;

  useEffect(() => {
    if (typeof window === "undefined") return;
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
    conn.on("disconnect", () => {
      dispatch(setConnection("reconnecting"));
    });
    conn.io.on("reconnect_failed", () => {
      dispatch(setConnection("disconnected"));
    });
    conn.on("connect_error", () => {
      dispatch(setConnection("disconnected"));
    });

    conn.on("state-sync", (payload) => dispatch(applySync(payload)));
    conn.on("game-started", () => dispatch(gameStarted()));
    conn.on("question-start", (payload) => dispatch(questionStart(payload)));
    conn.on("question-end", (payload) => dispatch(questionEnd(payload)));
    conn.on("answer-result", (payload) => dispatch(answerResult(payload)));
    conn.on("leaderboard", (payload) => dispatch(leaderboardReceived(payload)));
    conn.on("game-over", (payload) =>
      dispatch(
        gameOver({ entries: payload.entries, eloChanges: payload.eloChanges }),
      ),
    );
    conn.on("player-connection", (payload) =>
      dispatch(playerConnection(payload)),
    );

    bindRef.current?.(conn);
    setSocket(conn);

    return () => {
      conn.disconnect();
      setSocket(null);
      dispatch(resetGame());
    };
  }, [dispatch, userType, gameCode, token]);

  return { socket };
}
