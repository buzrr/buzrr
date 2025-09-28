"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CheckLocalPlayer() {
  const router = useRouter();
  useEffect(() => {
    if (window !== undefined) {
      const playerId = window.localStorage.getItem("playerId");
      if (playerId) {
        router.push(`player/joinRoom/${playerId}`);
      }
    }
  }, [router]);
  return <></>;
}
