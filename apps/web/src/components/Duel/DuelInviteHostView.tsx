"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/Button";
import ShareRoom from "@/components/ShareRoom";
import { useDuelInvite } from "@/hooks/useDuelInvite";
import { buildDuelInviteUrl } from "@/lib/join-link";
import { useCancelDuelInviteMutation } from "@/lib/modules/duel/hooks";
import type { DuelInvite } from "@/lib/modules/duel/api";
import type { DuelMatchedPayload } from "@/types/socket-events";

/**
 * What the challenger sees while waiting. The socket opened here is also the
 * presence signal the server checks before letting a friend accept, so a duel
 * never starts against an absent host.
 */
export default function DuelInviteHostView({
  invite,
  onMatched,
}: {
  invite: DuelInvite;
  onMatched: (payload: DuelMatchedPayload) => void;
}) {
  const router = useRouter();
  // Connect but never call `accept` — the host can't claim their own challenge.
  const { status, error } = useDuelInvite({ code: invite.code, onMatched });
  const cancel = useCancelDuelInviteMutation();
  const remaining = useCountdown(invite.expiresAt);

  if (remaining <= 0) {
    return (
      <div className="flex flex-col items-center gap-4 bg-white dark:bg-dark rounded-2xl p-6 w-full max-w-sm shadow border border-card-light dark:border-off-dark animate-fade-up">
        <p className="text-xl font-black text-dark dark:text-white text-center">
          Challenge expired
        </p>
        <p className="text-sm text-off-dark dark:text-off-white text-center">
          Nobody accepted in time. Create a fresh link to try again.
        </p>
        <Button fullWidth onClick={() => router.replace("/duel")}>
          Back to duel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 bg-white dark:bg-dark rounded-2xl p-6 w-full max-w-sm shadow border border-card-light dark:border-off-dark animate-fade-up">
      <div className="flex flex-col items-center gap-1">
        <p className="text-xl font-black text-dark dark:text-white text-center">
          {status === "matched"
            ? "Your friend joined — starting…"
            : "Waiting for your friend…"}
        </p>
        <p className="text-xs text-off-dark dark:text-off-white text-center">
          Send them this link. The duel starts the moment they accept.
        </p>
      </div>

      <ShareRoom
        url={buildDuelInviteUrl(invite.code)}
        caption="SCAN TO CHALLENGE"
        toastMessage="Challenge link copied!"
      />

      <p className="text-xs text-off-dark dark:text-off-white text-center">
        Link expires in {formatRemaining(remaining)} · Friendly duels don&apos;t
        affect your rating
      </p>

      {status === "error" && error && (
        <p className="text-sm text-red-light dark:text-red-dark text-center">
          {error}
        </p>
      )}

      <Button
        variant="outline"
        fullWidth
        disabled={cancel.isPending || status === "matched"}
        onClick={() =>
          cancel.mutate(invite.code, {
            onSuccess: () => router.replace("/duel"),
            // A 409 means a friend accepted first, and duel:matched is already
            // navigating us into the game.
            onError: () => toast.error("Couldn't cancel the challenge."),
          })
        }
      >
        Cancel challenge
      </Button>
    </div>
  );
}

function useCountdown(expiresAt: number): number {
  const [remaining, setRemaining] = useState(() => expiresAt - Date.now());
  useEffect(() => {
    const interval = setInterval(
      () => setRemaining(expiresAt - Date.now()),
      1000,
    );
    return () => clearInterval(interval);
  }, [expiresAt]);
  return remaining;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
