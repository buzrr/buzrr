"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import { Button } from "@/components/ui/Button";
import { useEndRoomMutation } from "@/lib/modules/game-sessions/hooks";

/**
 * Host control shown on every gameplay screen (lobby, question, reveal,
 * leaderboard). Ending a started game saves the current standings as the game
 * result before tearing the room down — the modal stays open with a loader
 * until that write finishes. On the final screen the game is already over and
 * its result is saved, so the button is just an exit.
 */
export default function EndQuizButton({
  roomId,
  redirectTo = "/admin/history",
  alreadyEnded = false,
}: {
  roomId: string;
  redirectTo?: string;
  /** True on the final leaderboard: the game already ended, so just exit. */
  alreadyEnded?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const endRoomMutation = useEndRoomMutation();

  async function confirmEnd() {
    setEnding(true);
    try {
      // Resolves only after the server has persisted the GameResult.
      await endRoomMutation.mutateAsync(roomId);
      router.push(redirectTo);
    } catch {
      toast.error("Could not end the quiz. Please try again.");
      setEnding(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        className="fixed top-3 right-4 md:right-8 z-50 bg-red-light dark:bg-red-dark text-white dark:text-dark hover:bg-red-dark"
        onClick={() => (alreadyEnded ? router.push(redirectTo) : setOpen(true))}
      >
        {alreadyEnded ? "Exit" : "End Quiz"}
      </Button>
      <ConfirmationModal
        open={open}
        setOpen={setOpen}
        onClick={confirmEnd}
        confirming={ending}
        confirmLabel="End Quiz"
        confirmingLabel="Saving results…"
        desc="This ends the quiz for everyone and saves the current results. This can't be undone."
      />
    </>
  );
}
