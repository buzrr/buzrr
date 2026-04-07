"use client";
import { clearPlayerLocalSession } from "@/lib/player-session";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CheckLocalPlayer() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const playerId = window.localStorage.getItem("playerId");
    const playerToken = window.localStorage.getItem("playerToken");
    if (playerId && !playerToken) {
      clearPlayerLocalSession();
      return;
    }
    if (playerId && playerToken) {
      router.push(`/player/joinRoom/${playerId}`);
    }
  }, [router]);
  return <></>;
}
