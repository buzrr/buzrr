"use client";

import { useState } from "react";
import { Box, Modal } from "@mui/material";
import { toast } from "react-toastify";
import ModalCloseButton from "@/components/ModalCloseButton";
import TextInput from "@/components/ui/TextInput";
import { authClient } from "@/lib/auth-client";
import { persistor } from "@/state/store";
import style from "@/utils/modalStyle";

const CONFIRM_PHRASE = "delete my profile";

/**
 * Danger-zone account deletion with a typed confirmation gate: the delete
 * button stays disabled until the user writes "delete my profile". Deleting
 * also signs the user out; we then land them back on the landing page.
 */
export default function DeleteProfileButton() {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [pending, setPending] = useState(false);

  const matches = phrase.trim().toLowerCase() === CONFIRM_PHRASE;

  function handleClose() {
    if (pending) return;
    setOpen(false);
    setPhrase("");
  }

  async function handleDelete() {
    if (!matches || pending) return;
    setPending(true);
    const { error } = await authClient.deleteUser({});
    if (error) {
      setPending(false);
      toast.error(error.message || "Could not delete your profile. Try again.");
      return;
    }
    await persistor.purge();
    // Hard navigation so the router cache drops the logged-in payload.
    window.location.href = "/";
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-white dark:text-dark dark:font-bold rounded-lg py-2 px-4 bg-red-light dark:bg-red-dark w-full cursor-pointer"
      >
        Delete profile
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="delete-profile-title"
        aria-describedby="delete-profile-desc"
      >
        <Box
          sx={style}
          className="bg-light-bg dark:bg-[#27272A] rounded-xl w-4/5 sm:w-3/5 md:w-2/5 max-w-[600px]"
        >
          <ModalCloseButton onClose={handleClose} />
          <div className="p-6 flex flex-col">
            <p
              id="delete-profile-title"
              className="text-xl font-bold mb-2 text-dark dark:text-white"
            >
              Delete your profile?
            </p>
            <p
              id="delete-profile-desc"
              className="text-[#4E4E56] dark:text-off-white mb-4 text-sm"
            >
              This permanently deletes your account, your quizzes and your game
              history. This cannot be undone.
            </p>
            <TextInput
              label={`Type “${CONFIRM_PHRASE}” to confirm`}
              placeholder={CONFIRM_PHRASE}
              autoComplete="off"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
            />
            <button
              onClick={handleDelete}
              disabled={!matches || pending}
              className="mt-4 text-sm text-white dark:text-dark dark:font-bold rounded-lg py-2 px-4 bg-red-light dark:bg-red-dark w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "Deleting..." : "Delete profile"}
            </button>
          </div>
        </Box>
      </Modal>
    </>
  );
}
