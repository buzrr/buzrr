"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { fetchApiAccessToken } from "@/lib/api/get-access-token";
import { capture } from "@/lib/analytics";
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
  // Mirrors `queuedAt` state so socket callbacks read a fresh value.
  const queuedAtRef = useRef<number | null>(null);
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
    queuedAtRef.current = null;

    const waitedMs = () =>
      queuedAtRef.current === null ? null : Date.now() - queuedAtRef.current;

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
      const now = Date.now();
      setStatus("queued");
      setQueuedAt(now);
      queuedAtRef.current = now;
      capture("duel_queue_started");
    });
    conn.on("duel:matched", (payload) => {
      setStatus("matched");
      capture("duel_matched", { waited_ms: waitedMs() });
      conn.disconnect();
      socketRef.current = null;
      onMatchedRef.current(payload);
    });
    conn.on("duel:queue-timeout", () => {
      setStatus("timeout");
      capture("duel_queue_timeout", { waited_ms: waitedMs() });
      conn.disconnect();
      socketRef.current = null;
    });
    conn.on("duel:error", (payload) => {
      setStatus("error");
      setError(payload.message);
      capture("duel_queue_failed", {
        reason: payload.message,
        waited_ms: waitedMs(),
      });
      conn.disconnect();
      socketRef.current = null;
    });
    conn.on("connect_error", () => {
      setStatus("error");
      setError("Could not reach the matchmaking server.");
      capture("duel_queue_failed", { reason: "connect_error" });
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
    queuedAtRef.current = null;
  }, []);

  return { status, error, queuedAt, findMatch, cancel };
}
