"use client";

import { Box, Modal } from "@mui/material";
import Image from "next/image";
import { useState } from "react";

const style = {
  position: "absolute" as const,
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "#202020",
  border: "2px solid #eee",
  borderRadius: "10px",
  boxShadow: 24,
  p: 4,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
};

export default function ShowMedia(props: { media: string; mediaType: string }) {
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
      <button
        className="p-1 ml-auto text-xs text-white dark:text-dark bg-lprimary dark:bg-dprimary rounded-md"
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
        <Box sx={style} className="">
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
