"use client";

import { useState } from "react";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import { authClient } from "@/lib/auth-client";
import { persistor } from "@/state/store";

/** Confirm-and-sign-out modal shared by the sidebar and settings danger zone. */
export default function SignOutButton({
  btnTitle,
  btnContent,
  btnStyle,
  confirmText,
}: {
  btnTitle: string;
  btnContent?: React.ReactNode;
  btnStyle?: string;
  confirmText: string;
}) {
  const [open, setOpen] = useState(false);

  function handleSignOut() {
    authClient.signOut({
      fetchOptions: {
        onSuccess: async () => {
          await persistor.purge();
          // Hard navigation so the router cache drops the
          // logged-in /admin payload along with client state.
          window.location.href = "/";
        },
      },
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={btnStyle}>
        {btnContent ?? btnTitle}
      </button>

      <ConfirmationModal
        open={open}
        setOpen={setOpen}
        onClick={handleSignOut}
        desc={confirmText}
        confirmLabel={btnTitle}
      />
    </>
  );
}
