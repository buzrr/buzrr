"use client";

import { Box, Modal } from "@mui/material";
import clsx from "clsx";
import Image from "next/image";
import { useState } from "react";
import ModalCloseButton from "@/components/ModalCloseButton";

const style = {
  position: "absolute" as const,
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  border: "2px solid #eee",
  borderRadius: "10px",
  boxShadow: 24,
  p: 4,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

export default function ShowMedia(props: {
  media: string;
  mediaType: string;
  /** Also opens it: e.g. the picture icon next to the button. */
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  const mediaType = props.mediaType;

  return (
    <>
      {props.icon && (
        <button
          type="button"
          aria-label="View image"
          title="View image"
          onClick={handleOpen}
          className="cursor-pointer hover:text-lprimary dark:hover:text-dprimary"
        >
          {props.icon}
        </button>
      )}
      <button
        type="button"
        className={clsx(
          "p-1 text-xs text-white dark:text-dark bg-lprimary dark:bg-dprimary rounded-md",
          props.icon ? "ml-3" : "ml-auto",
        )}
        onClick={handleOpen}
      >
        View image
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style} className="max-w-[600px] bg-light-bg dark:bg-dark">
          <ModalCloseButton
            onClose={handleClose}
            className="text-dark dark:text-white hover:bg-black/5 dark:hover:bg-white/10"
          />
          {mediaType === "image" && (
            <Image
              src={props.media}
              className="w-full h-full object-cover"
              alt="media Image"
              height={200}
              width={200}
            />
          )}
        </Box>
      </Modal>
    </>
  );
}
