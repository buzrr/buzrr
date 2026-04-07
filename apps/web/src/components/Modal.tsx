"use client";
import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Modal from "@mui/material/Modal";
import style from "@/utils/modalStyle";

export default function BasicModal(props: {
  btnTitle: string;
  btnStyle?: string;
  children: React.ReactNode;
  isEdit?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const id = React.useId();
  const titleId = `${id}-title`;
  const descId = `${id}-desc`;

  return (
    <>
      <button
        onClick={handleOpen}
        className={
          props.btnStyle || (props.isEdit ? "p-1 text-lprimary mr-1 hover:bg-cardhover-light rounded-md dark:bg-dark-bg" : "text-white font-sm bg-dark-bg dark:bg-dark-bg rounded-lg w-full mx-auto md:ml-5 p-2")
        }
      >
        {props.btnTitle}
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <Box
          sx={style}
          className="dark:bg-dark-bg bg-light-bg rounded-xl w-4/5 md:w-1/2 p-6 overflow-y-auto max-h-[90vh]"
        >
          <Typography
            id={titleId}
            variant="h6"
            component="h2"
            className="font-bold text-center w-full mb-4 dark:text-white"
          >
            {props.btnTitle}
          </Typography>
          <div id={descId}>{props.children}</div>
        </Box>
      </Modal>
    </>
  );
}
