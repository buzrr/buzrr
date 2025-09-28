"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ValidatePlayer = (params: { playerId: string }) => {
  const router = useRouter();
  useEffect(() => {
    if (window !== undefined) {
      const playerId = window.localStorage.getItem("playerId");
      if (!playerId || playerId !== params.playerId) {
        if (playerId) {
          window.localStorage.removeItem("playerId");
        }
        router.push("/player");
      }
    }
  });
  return <></>;
};

export default ValidatePlayer;
