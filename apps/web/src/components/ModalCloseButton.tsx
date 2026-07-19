"use client";

import clsx from "clsx";
import { RxCross2 } from "react-icons/rx";
import { IconButton } from "@/components/ui/IconButton";

/** Shared top-right ✕ for modal cards; the overlay/Esc still close as before. */
export default function ModalCloseButton({
  onClose,
  className,
}: {
  onClose: () => void;
  className?: string;
}) {
  return (
    <IconButton
      aria-label="Close"
      className={clsx(
        "absolute top-3 right-3 z-10 rounded-full",
        className ??
          "text-dark dark:text-white hover:bg-card-light dark:hover:bg-card-dark",
      )}
      onClick={onClose}
      icon={<RxCross2 size={20} />}
    />
  );
}
