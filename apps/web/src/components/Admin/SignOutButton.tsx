"use client";

import BasicModal from "@/components/Modal";
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
  return (
    <BasicModal btnTitle={btnTitle} btnContent={btnContent} btnStyle={btnStyle}>
      <div className="text-center">
        <p className="text-dark dark:text-white">{confirmText}</p>
        <button
          className="text-sm text-white dark:text-dark dark:font-bold rounded-lg py-2 px-4 my-2 bg-red-light dark:bg-red-dark w-full"
          onClick={() =>
            authClient.signOut({
              fetchOptions: {
                onSuccess: async () => {
                  await persistor.purge();
                  // Hard navigation so the router cache drops the
                  // logged-in /admin payload along with client state.
                  window.location.href = "/";
                },
              },
            })
          }
        >
          {btnTitle}
        </button>
      </div>
    </BasicModal>
  );
}
