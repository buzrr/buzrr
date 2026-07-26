"use client";
import { useEffect, useRef, useState } from "react";
import type { GameSocket } from "@/types/socket-events";
import { useGameSocket } from "./useGameSocket";

interface UsePlayerSocketOptions {
  playerId: string;
  gameCode: string;
  /**
   * Called when the host kicks or bans this player. The saved player identity
   * is deliberately kept, so the client can send them back to the room-code
   * screen rather than making them create a profile again.
   */
  onRemoved?: (info: { banned: boolean }) => void;
  /** Called when the room itself is gone (host ended the session). */
  onSessionEnded?: () => void;
}

export function usePlayerSocket({
  playerId,
  gameCode,
  onRemoved,
  onSessionEnded,
}: UsePlayerSocketOptions): { socket: GameSocket | null } {
  const callbacks = useRef({ onRemoved, onSessionEnded });
  useEffect(() => {
    callbacks.current = { onRemoved, onSessionEnded };
  }, [onRemoved, onSessionEnded]);
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

      // A kick/ban only ends this room's membership — the player keeps their
      // profile and can enter another room code straight away.
      socket.on("player-removed", (player) => {
        if (player.id === playerId) {
          callbacks.current.onRemoved?.({ banned: player.banned ?? false });
        }
      });

      // The room is deleted server-side once the host ends the session; drop
      // the local player session so a refresh doesn't point at a dead room.
      socket.on("game-over", () => {
        clearLocalPlayerSession();
      });
      socket.on("game-session-ended", () => {
        clearLocalPlayerSession();
        callbacks.current.onSessionEnded?.();
      });
    },
  });
}
