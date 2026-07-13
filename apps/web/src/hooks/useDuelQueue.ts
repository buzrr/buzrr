"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { fetchApiAccessToken } from "@/lib/api/get-access-token";
import type { DuelMatchedPayload, GameSocket } from "@/types/socket-events";

export type DuelQueueStatus =
  | "idle"
  | "connecting"
  | "queued"
  | "matched"
  | "timeout"
  | "error";

/**
 * Matchmaking-queue connection (userType=duel, no gameCode). The server
 * pairs players by ELO proximity and pushes `duel:matched` with the room to
 * join.
 */
export function useDuelQueue(options: {
  onMatched: (payload: DuelMatchedPayload) => void;
}) {
  const [status, setStatus] = useState<DuelQueueStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [queuedAt, setQueuedAt] = useState<number | null>(null);
  const socketRef = useRef<GameSocket | null>(null);
  const onMatchedRef = useRef(options.onMatched);
  onMatchedRef.current = options.onMatched;

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  const findMatch = useCallback(async () => {
    setError(null);
    setStatus("connecting");

    const token = await fetchApiAccessToken();
    if (!token) {
      setStatus("error");
      setError("You must be signed in to duel.");
      return;
    }

    socketRef.current?.disconnect();
    const conn: GameSocket = io(
      `${process.env.NEXT_PUBLIC_SOCKET_URL}/?userType=duel`,
      { withCredentials: true, auth: { token } },
    );
    socketRef.current = conn;

    conn.on("connect", () => {
      conn.emit("duel:queue");
    });
    conn.on("duel:queued", () => {
      setStatus("queued");
      setQueuedAt(Date.now());
    });
    conn.on("duel:matched", (payload) => {
      setStatus("matched");
      conn.disconnect();
      socketRef.current = null;
      onMatchedRef.current(payload);
    });
    conn.on("duel:queue-timeout", () => {
      setStatus("timeout");
      conn.disconnect();
      socketRef.current = null;
    });
    conn.on("duel:error", (payload) => {
      setStatus("error");
      setError(payload.message);
      conn.disconnect();
      socketRef.current = null;
    });
    conn.on("connect_error", () => {
      setStatus("error");
      setError("Could not reach the matchmaking server.");
      conn.disconnect();
      socketRef.current = null;
    });
  }, []);

  const cancel = useCallback(() => {
    socketRef.current?.emit("duel:cancel");
    socketRef.current?.disconnect();
    socketRef.current = null;
    setStatus("idle");
    setQueuedAt(null);
  }, []);

  return { status, error, queuedAt, findMatch, cancel };
}
