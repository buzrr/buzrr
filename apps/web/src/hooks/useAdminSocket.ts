"use client";
import { useEffect, useRef, useState } from "react";
import { useAppDispatch } from "@/state/hooks";
import { addPlayer, removePlayer } from "@/state/admin/playersSlice";
import { fetchApiAccessToken } from "@/lib/api/get-access-token";
import type { GameSocket, PlayerRemovedPayload } from "@/types/socket-events";
import { useGameSocket } from "./useGameSocket";

interface UseAdminSocketOptions {
  gameCode: string;
  onPlayerRemoved?: (player: PlayerRemovedPayload) => void;
  onGameStarted?: () => void;
  onGameOver?: () => void;
}

export function useAdminSocket({
  gameCode,
  onPlayerRemoved,
  onGameStarted,
  onGameOver,
}: UseAdminSocketOptions): { socket: GameSocket | null } {
  const dispatch = useAppDispatch();
  const callbacks = useRef({ onPlayerRemoved, onGameStarted, onGameOver });
  useEffect(() => {
    callbacks.current = { onPlayerRemoved, onGameStarted, onGameOver };
  }, [onPlayerRemoved, onGameStarted, onGameOver]);

  // Admin sockets authenticate with a JWT: the session cookie is host-scoped
  // to the Next.js app and never reaches a cross-origin socket server. If the
  // token fetch fails we still connect and let the cookie fallback try.
  const [auth, setAuth] = useState<{ token?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchApiAccessToken()
      .then((token) => {
        if (!cancelled) setAuth({ token: token ?? undefined });
      })
      .catch(() => {
        if (!cancelled) setAuth({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return useGameSocket({
    userType: "admin",
    gameCode,
    token: auth?.token,
    ready: auth !== null,
    bind: (socket) => {
      socket.on("player-joined", (player) => {
        dispatch(addPlayer(player));
      });
      socket.on("player-removed", (player) => {
        dispatch(removePlayer(player));
        callbacks.current.onPlayerRemoved?.(player);
      });
      // A voluntary leave: drop them from the roster, but no "you removed this
      // player" toast — the host didn't kick them.
      socket.on("player-left", (player) => {
        dispatch(removePlayer(player));
      });
      socket.on("game-started", () => {
        callbacks.current.onGameStarted?.();
      });
      socket.on("game-over", () => {
        callbacks.current.onGameOver?.();
      });
    },
  });
}
