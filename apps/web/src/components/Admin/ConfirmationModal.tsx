"use client";
import { useId } from "react";
import { Box, Modal } from "@mui/material";
import style from "@/utils/modalStyle";
import ClientImage from "@/components/ClientImage";
import ModalCloseButton from "@/components/ModalCloseButton";

export default function ConfirmationModal({
  open,
  setOpen,
  onClick,
  desc,
  confirmLabel = "Submit",
  confirming = false,
  confirmingLabel = "Saving…",
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  onClick: () => void;
  desc?: string;
  /** Label of the confirming button (e.g. "Logout"); defaults to "Submit". */
  confirmLabel?: string;
  /** While true the action is in flight: the modal locks and shows a loader. */
  confirming?: boolean;
  confirmingLabel?: string;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  return (
    <Modal
      open={open}
      // Don't let a click-away or Escape dismiss the modal mid-action.
      onClose={() => {
        if (!confirming) setOpen(false);
      }}
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <Box
        sx={style}
        className="bg-light-bg dark:bg-[#27272A] rounded-xl w-4/5 sm:w-3/5 md:w-2/5 max-w-[600px]"
      >
        {!confirming && <ModalCloseButton onClose={() => setOpen(false)} />}
        <div className="p-6 flex flex-col justify-center items-center">
          <ClientImage
            props={{
              src: "/images/endGame.svg",
              alt: "End game",
              width: 140,
              height: 140,
            }}
          />
          <p id={titleId} className="text-xl font-bold mb-2 dark:text-white">
            Are you sure?
          </p>
          <p
            id={descId}
            className="text-[#4E4E56] mb-4 dark:text-white text-center"
          >
            {desc}
          </p>
          <div className="w-full grid md:grid-cols-2 md:gap-x-4 gap-y-4 md:gap-y-0">
            <button
              onClick={() => setOpen(false)}
              disabled={confirming}
              className="text-white bg-red-light rounded-lg py-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={onClick}
              disabled={confirming}
              className="flex items-center justify-center gap-2 bg-white text-red-light dark:text-red-dark dark:border-red-dark border-2 font-semibold py-2 border-red-light rounded-lg dark:bg-[#27272A] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {confirming && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-light dark:border-red-dark border-t-transparent dark:border-t-transparent" />
              )}
              {confirming ? confirmingLabel : confirmLabel}
            </button>
          </div>
        </div>
      </Box>
    </Modal>
  );
}
