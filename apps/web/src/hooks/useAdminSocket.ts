"use client";
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useAppDispatch } from "@/state/hooks";
import { clearConnection, createConnection } from "@/state/socket/socketSlice";
import { addPlayer, removePlayer } from "@/state/admin/playersSlice";
import type { PlayerPayload } from "@/types/socket-events";

interface UseAdminSocketOptions {
  userId: string;
  gameCode: string;
  onPlayerRemoved?: (player: PlayerPayload) => void;
  onGameStarted?: () => void;
}

export function useAdminSocket({
  userId,
  gameCode,
  onPlayerRemoved,
  onGameStarted,
}: UseAdminSocketOptions) {
  const dispatch = useAppDispatch();
  const onPlayerRemovedRef = useRef(onPlayerRemoved);
  const onGameStartedRef = useRef(onGameStarted);

  useEffect(() => {
    onPlayerRemovedRef.current = onPlayerRemoved;
    onGameStartedRef.current = onGameStarted;
  }, [onPlayerRemoved, onGameStarted]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const socket = io(
      `${process.env.NEXT_PUBLIC_SOCKET_URL}/?userType=admin&gameCode=${gameCode}`,
      {
        withCredentials: true,
      },
    );

    socket.on("connect", () => {
      dispatch(createConnection(socket));
    });

    socket.on("player-joined", (player: PlayerPayload) => {
      dispatch(addPlayer(player));
    });

    socket.on("player-removed", (player: PlayerPayload) => {
      dispatch(removePlayer(player));
      onPlayerRemovedRef.current?.(player);
    });

    socket.on("game-started", () => {
      onGameStartedRef.current?.();
    });

    socket.on("disconnect", () => {
      dispatch(clearConnection());
    });

    return () => {
      socket.disconnect();
      dispatch(clearConnection());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, gameCode, userId]);
}
