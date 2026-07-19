"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import modalStyle from "@/utils/modalStyle";
import supportLinks from "@/data/support-links.json";

const STORAGE_KEY = "buzrr:support-nudge-dismissed-at";
const SHOW_EVERY_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Gentle donation nudge for the admin dashboard. Shows at most once every
 * 3 days; any dismissal (button, backdrop, Escape) resets the timer.
 */
export default function SupportNudge() {
  const [open, setOpen] = useState(false);
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  useEffect(() => {
    try {
      const dismissedAt = Number(window.localStorage.getItem(STORAGE_KEY));
      if (dismissedAt && Date.now() - dismissedAt < SHOW_EVERY_MS) return;
    } catch {
      // Storage unavailable (private mode etc.) — still show, just not gated.
    }
    const timer = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // Best effort — worst case the nudge shows again next visit.
    }
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      onClose={dismiss}
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <Box
        sx={modalStyle}
        className="bg-light-bg dark:bg-dark-bg rounded-2xl w-[90vw] max-w-[430px] p-6"
      >
        <h2
          id={titleId}
          className="text-lg font-black text-dark dark:text-white text-center"
        >
          ❤️ Enjoying Buzrr?
        </h2>
        <div id={descId} className="mt-3 text-center">
          <p className="text-sm text-dark/80 dark:text-gray">
            If Buzrr has made your quizzes, classrooms, or events a little more
            fun, consider supporting its development.
          </p>
          <p className="mt-2 text-sm text-dark/80 dark:text-gray">
            Even buying a chai helps keep late-night commits coming ☕
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href={supportLinks.supportPage}
            onClick={dismiss}
            className="w-full text-center px-5 py-2.5 rounded-xl font-bold bg-lprimary dark:bg-dprimary text-white dark:text-dark hover:opacity-90 transition-opacity"
          >
            Sponsor Buzrr
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="w-full px-5 py-2.5 rounded-xl font-bold text-dark dark:text-white hover:bg-card-light dark:hover:bg-card-dark transition-colors hover:cursor-pointer"
          >
            Maybe later
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-dark/50 dark:text-off-white">
          Open source • Community supported • Always optional
        </p>
      </Box>
    </Modal>
  );
}
