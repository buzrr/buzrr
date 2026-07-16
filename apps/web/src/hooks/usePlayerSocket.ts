"use client";
import { useEffect, useRef, useState } from "react";
import type { GameSocket } from "@/types/socket-events";
import { useGameSocket } from "./useGameSocket";

interface UsePlayerSocketOptions {
  playerId: string;
  gameCode: string;
  /** Called when this player is removed by the host or the game ends. */
  onRemoved?: () => void;
}

export function usePlayerSocket({
  playerId,
  gameCode,
  onRemoved,
}: UsePlayerSocketOptions): { socket: GameSocket | null } {
  const onRemovedRef = useRef(onRemoved);
  useEffect(() => {
    onRemovedRef.current = onRemoved;
  }, [onRemoved]);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(window.localStorage.getItem("playerToken"));
  }, []);

  return useGameSocket({
    userType: "player",
    gameCode,
    token: token ?? undefined,
    bind: (socket: GameSocket) => {
      const clearLocalPlayerSession = () => {
        window.localStorage.removeItem("playerToken");
        window.localStorage.removeItem("playerId");
      };

      socket.on("player-removed", (player) => {
        if (player.id === playerId) {
          clearLocalPlayerSession();
          onRemovedRef.current?.();
        }
      });

      // The room is deleted server-side once the host ends the session; drop
      // the local player session so a refresh doesn't point at a dead room.
      socket.on("game-over", () => {
        clearLocalPlayerSession();
      });
      socket.on("game-session-ended", () => {
        clearLocalPlayerSession();
        onRemovedRef.current?.();
      });
    },
  });
}
