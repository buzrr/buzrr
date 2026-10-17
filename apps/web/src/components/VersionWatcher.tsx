"use client";

import { useEffect } from "react";

const OWN = process.env.NEXT_PUBLIC_BUILD_ID ?? "";
const EVERY_MS = 2 * 60 * 1000;

/**
 * Cache buster for open tabs: JS/CSS files are content-hashed, but a page
 * that stays open keeps running the old bundle after a deploy (talking to a
 * newer server). This checks `/build-id` when the tab becomes visible and
 * every few minutes, and reloads once a different build is live. Games
 * survive it — a reloaded client resyncs from the server.
 */
export default function VersionWatcher() {
  useEffect(() => {
    if (!OWN) return;
    let reloading = false;
    const check = async () => {
      if (reloading || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/build-id?ts=${Date.now()}`, {
          cache: "no-store",
        });
        const { id } = (await res.json()) as { id?: string };
        if (id && id !== OWN) {
          reloading = true;
          window.location.reload();
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
