"use client";
import { useRef } from "react";
import { useAppDispatch } from "@/state/hooks";
import { addPlayer, removePlayer } from "@/state/admin/playersSlice";
import type { GameSocket, PlayerPayload } from "@/types/socket-events";
import { useGameSocket } from "./useGameSocket";

interface UseAdminSocketOptions {
  gameCode: string;
  onPlayerRemoved?: (player: PlayerPayload) => void;
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
  callbacks.current = { onPlayerRemoved, onGameStarted, onGameOver };

  return useGameSocket({
    userType: "admin",
    gameCode,
    bind: (socket) => {
      socket.on("player-joined", (player) => {
        dispatch(addPlayer(player));
      });
      socket.on("player-removed", (player) => {
        dispatch(removePlayer(player));
        callbacks.current.onPlayerRemoved?.(player);
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
