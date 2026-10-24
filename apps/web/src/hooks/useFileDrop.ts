"use client";

import { useState, type DragEvent } from "react";

/** A drop target while a file is dragged over it: a thick coloured border. */
export const dropTargetClass =
  "!border-[3px] !border-solid !border-dprimary ring-4 ring-dprimary/20";

/**
 * Drag and drop a file onto an element: spread `dropProps` on it, style it
 * with `dropTargetClass` while `over`. Only the first dropped file is taken.
 */
export function useFileDrop(onFile: (file: File) => void, disabled = false) {
  const [over, setOver] = useState(false);
  const dropProps = {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (disabled || !e.dataTransfer.types.includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setOver(true);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      // Moving onto a child is no leave.
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        setOver(false);
      }
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      if (disabled) return;
      e.preventDefault();
      setOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
  };
  return { over, dropProps };
}
