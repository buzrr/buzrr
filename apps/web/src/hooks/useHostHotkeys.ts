"use client";

import { useEffect } from "react";

/** The visible, enabled button marked `data-host-key={key}`, if any. */
function hostButton(key: "next" | "skip"): HTMLButtonElement | null {
  const all = document.querySelectorAll<HTMLButtonElement>(
    `[data-host-key="${key}"]`,
  );
  for (const b of all) {
    if (!b.disabled && b.offsetParent !== null) return b;
  }
  return null;
}

/**
 * The host's keyboard on the game screens: Space presses the "next" button
 * that is on screen (`data-host-key="next"`), Escape the skip / go-on one
 * (`data-host-key="skip"`). Space never activates whatever button has focus
 * (e.g. "End" after a mouse click): ending stays a mouse-only action. Typing
 * in a field and open dialogs are left alone.
 */
export function useHostHotkeys(): void {
  useEffect(() => {
    const typing = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
    const dialogOpen = () =>
      document.querySelector('[role="dialog"], [role="presentation"]') !== null;
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat || typing(e.target) || dialogOpen()) return;
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        hostButton("next")?.click();
      } else if (e.key === "Escape") {
        const b = hostButton("skip");
        if (b) {
          e.preventDefault();
          b.click();
        }
      }
    };
    // A focused button would also react to Space on key-up: not here.
    const onUp = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.key === " ") && !typing(e.target)) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);
}
