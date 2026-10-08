"use client";
import { useEffect, useRef, useState } from "react";
import type { GameSocket } from "@/types/socket";
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
  /**
   * Called when the room itself is gone (host ended the session). The saved
   * player identity is kept here too — the server only nulls `gameId` — so
   * the player goes back to the room-code screen with the same profile.
   */
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
      // A kick/ban only ends this room's membership — the player keeps their
      // profile and can enter another room code straight away.
      socket.on("player-removed", (player) => {
        if (player.id === playerId) {
          callbacks.current.onRemoved?.({ banned: player.banned ?? false });
        }
      });

      // The room is deleted server-side once the host ends the session and
      // the player is detached (gameId -> null), but the profile is tied to
      // this device and survives — a refresh of the play page redirects to
      // the room-code screen on its own.
      socket.on("game-session-ended", () => {
        callbacks.current.onSessionEnded?.();
      });
    },
  });
}
