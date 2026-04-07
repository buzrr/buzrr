"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearPlayerLocalSession } from "@/lib/player-session";

const ValidatePlayer = (params: { playerId: string }) => {
  const router = useRouter();
  useEffect(() => {
    if (typeof window !== "undefined") {
      const playerId = window.localStorage.getItem("playerId");
      if (!playerId || playerId !== params.playerId) {
        clearPlayerLocalSession();
        router.push("/player");
      }
    }
  }, [params.playerId, router]);
  return <></>;
};

export default ValidatePlayer;
