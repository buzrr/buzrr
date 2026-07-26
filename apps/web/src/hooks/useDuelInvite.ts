"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { fetchApiAccessToken } from "@/lib/api/get-access-token";
import type {
  DuelInviteFailure,
  DuelMatchedPayload,
  GameSocket,
} from "@/types/socket-events";

export type DuelInviteStatus =
  | "connecting"
  | "waiting"
  | "accepting"
  | "matched"
  | "error";

const FAILURE_MESSAGES: Record<DuelInviteFailure, string> = {
  "not-found": "This challenge link has expired.",
  claimed: "Someone else already accepted this challenge.",
  self: "You can't duel yourself — send this link to a friend.",
  "host-offline":
    "Your friend isn't at the table right now. Ask them to reopen the link.",
  busy: "One of you is already in a duel. Finish it first.",
  "no-questions": "No duel questions are available right now.",
  error: "Something went wrong starting the duel. Try again.",
};

/**
 * Waiting-room connection for a friend challenge (`intent=invite`). Both roles
 * open it: it's what marks the host as "present", and what guarantees the guest
 * is listening before `duel:matched` fires (socket.io won't buffer room emits).
 */
export function useDuelInvite(options: {
  code: string;
  onMatched: (payload: DuelMatchedPayload) => void;
}) {
  const { code } = options;
  const [status, setStatus] = useState<DuelInviteStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<GameSocket | null>(null);
  const onMatchedRef = useRef(options.onMatched);
  onMatchedRef.current = options.onMatched;

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      const token = await fetchApiAccessToken();
      if (cancelled) return;
      if (!token) {
        setStatus("error");
        setError("You must be signed in to duel.");
        return;
      }

      const conn: GameSocket = io(
        `${process.env.NEXT_PUBLIC_SOCKET_URL}/?userType=duel&intent=invite&gameCode=${encodeURIComponent(code)}`,
        { withCredentials: true, auth: { token } },
      );
      socketRef.current = conn;

      conn.on("connect", () => {
        setStatus((s) => (s === "connecting" ? "waiting" : s));
      });
      conn.on("duel:matched", (payload) => {
        setStatus("matched");
        conn.disconnect();
        socketRef.current = null;
        onMatchedRef.current(payload);
      });
      conn.on("duel:error", (payload) => {
        setStatus("error");
        setError(payload.message);
      });
      // socket.io retries on its own, so only give up once it stops — a single
      // connect_error would otherwise disable Accept for a socket that's about
      // to come back.
      const giveUp = () => {
        setStatus("error");
        setError("Could not reach the duel server.");
      };
      conn.on("connect_error", () => {
        if (conn.active) {
          setStatus("connecting");
          return;
        }
        giveUp();
      });
      conn.io.on("reconnect_failed", giveUp);
    }

    void connect();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [code]);

  const accept = useCallback(() => {
    const conn = socketRef.current;
    if (!conn?.connected) {
      setStatus("error");
      setError("Not connected to the duel server yet. Please wait.");
      return;
    }
    setError(null);
    setStatus("accepting");

    // Never strand the button on "Starting…" if the ack is lost.
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      setStatus("error");
      setError("The duel server didn't respond. Please try again.");
    }, 10_000);

    conn.emit("duel:invite-accept", { code }, (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      // On success the navigation happens in the `duel:matched` handler.
      if (result.ok) return;
      setStatus("error");
      setError(FAILURE_MESSAGES[result.reason ?? "error"]);
    });
  }, [code]);

  return { status, error, accept };
}
