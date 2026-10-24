"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/state/hooks";
import type { GamePhase } from "@buzrr/contract";

const OWN = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
const EVERY_MS = 2 * 60 * 1000;
/** Past the lobby, before the final standings: no reload in between. */
const RUNNING: ReadonlySet<GamePhase | "idle"> = new Set<GamePhase>([
  "starting",
  "ready",
  "question",
  "closed",
  "reveal",
  "scores",
]);

/**
 * Cache buster for open tabs: JS/CSS files are content-hashed, but a page
 * that stays open keeps running the old bundle after a deploy (talking to a
 * newer server). This checks `/build-id` when the tab becomes visible and
 * every few minutes, and reloads once a different build is live — but not
 * in the middle of a game: that waits for the final standings (or for the
 * page to leave the game). A game keeps running on the server instance it
 * started on until it ends (the old one drains on a rolling deploy); a reload
 * would move this device's socket to the new one mid-question.
 */
export default function VersionWatcher() {
  const phase = useAppSelector((state) => state.game.phase);
  const inGame = RUNNING.has(phase);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (stale && !inGame) window.location.reload();
  }, [stale, inGame]);

  useEffect(() => {
    if (!OWN) return;
    let found = false;
    const check = async () => {
      if (found || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/build-id?ts=${Date.now()}`, {
          cache: "no-store",
        });
        const { id } = (await res.json()) as { id?: string };
        if (id && id !== OWN) {
          found = true;
          setStale(true);
        }
      } catch {
        // offline or mid-deploy: try again later
      }
    };
    const timer = setInterval(check, EVERY_MS);
    // Safari restores tabs from its back/forward cache with the old bundle
    // still running: check on load and on every restore, too.
    void check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("focus", check);
    };
  }, []);
  return null;
}
