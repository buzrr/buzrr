"use client";
import * as React from "react";
import clsx from "clsx";
import Modal from "@mui/material/Modal";
import { LuPencil, LuPlus, LuX } from "react-icons/lu";
import { mutedText } from "@/components/Game/GameUI";

/**
 * Trigger button + dialog. The dialog is a centred card on desktop and a
 * bottom sheet on small screens. `children` may be a function receiving
 * `close`, so forms can dismiss the dialog once they are done.
 */
export default function BasicModal(props: {
  btnTitle: string;
  /** Custom trigger-button content (e.g. icon + label); falls back to btnTitle. */
  btnContent?: React.ReactNode;
  btnStyle?: string;
  /** Line under the dialog title. */
  subtitle?: string;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  isEdit?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const id = React.useId();
  const titleId = `${id}-title`;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={
          props.btnStyle ||
          (props.isEdit
            ? "p-1 text-lprimary mr-1 hover:bg-cardhover-light rounded-md dark:bg-dark-bg"
            : "text-white font-sm bg-dark-bg dark:bg-dark-bg rounded-lg w-full mx-auto md:ml-5 p-2")
        }
      >
        {props.btnContent ?? props.btnTitle}
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby={titleId}
        slotProps={{
          backdrop: {
            className: "!bg-[rgba(10,8,20,0.55)] backdrop-blur-[3px]",
          },
        }}
      >
        <div
          className="fixed inset-0 flex items-end md:items-center justify-center md:p-6 outline-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <div className="w-full md:max-w-[640px] max-h-[92dvh] overflow-y-auto flex flex-col rounded-t-[26px] md:rounded-[26px] border bg-white dark:bg-dark border-lprimary/15 dark:border-white/5 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] text-dark dark:text-white">
            <div className="flex items-start gap-4 px-5 pt-[22px] md:px-7 md:pt-[26px]">
              <span className="size-12 shrink-0 rounded-[14px] bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] dark:from-accent dark:to-accent-deep text-white flex items-center justify-center shadow-[0_10px_24px_-10px_#7c4ddb]">
                {props.isEdit ? <LuPencil size={22} /> : <LuPlus size={24} />}
              </span>
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="text-xl md:text-[22px] font-bold tracking-[-0.01em]"
                >
                  {props.btnTitle}
                </h2>
                {props.subtitle && (
                  <p
                    className={clsx(
                      "mt-1 text-[14.5px] leading-normal",
                      mutedText,
                    )}
                  >
                    {props.subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={handleClose}
                className={clsx(
                  "ml-auto size-9 shrink-0 rounded-[10px] flex items-center justify-center hover:bg-lprimary/8 dark:hover:bg-white/5 hover:text-dark dark:hover:text-white transition-colors cursor-pointer",
                  mutedText,
                )}
              >
                <LuX size={18} />
              </button>
            </div>
            {typeof props.children === "function"
              ? props.children(handleClose)
              : props.children}
          </div>
        </div>
      </Modal>
    </>
  );
}
