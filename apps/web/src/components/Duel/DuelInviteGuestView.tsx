"use client";

import Image from "next/image";
import Link from "next/link";
import { DEFAULT_AVATAR } from "@/constants";
import { Button } from "@/components/ui/Button";
import { useDuelInvite } from "@/hooks/useDuelInvite";
import type { DuelInvite } from "@/lib/modules/duel/api";
import type { DuelMatchedPayload } from "@/types/socket-events";

/**
 * What the invited friend sees. Accepting is an explicit click rather than an
 * on-load side effect, so a link preview or a stray tab can't burn the invite.
 */
export default function DuelInviteGuestView({
  invite,
  onMatched,
}: {
  invite: DuelInvite;
  onMatched: (payload: DuelMatchedPayload) => void;
}) {
  const { status, error, accept } = useDuelInvite({
    code: invite.code,
    onMatched,
  });

  const connecting = status === "connecting";
  const busy = status === "accepting" || status === "matched";

  return (
    <div className="flex flex-col items-center gap-5 bg-white dark:bg-dark rounded-2xl p-6 w-full max-w-sm shadow border border-card-light dark:border-off-dark animate-fade-up">
      <Image
        src={invite.host.image || DEFAULT_AVATAR}
        width={80}
        height={80}
        alt={invite.host.name}
        className="rounded-full h-20 w-20"
      />

      <div className="flex flex-col items-center gap-1">
        <p className="text-2xl font-black text-dark dark:text-white text-center">
          {invite.host.name}
        </p>
        <p className="text-sm text-off-dark dark:text-off-white text-center">
          challenged you to a 1v1
        </p>
        <p className="text-xs text-off-dark dark:text-off-white text-center">
          Rating {invite.host.elo} · Friendly duel, no rating at stake
        </p>
      </div>

      {!invite.hostOnline && (
        <p className="text-sm text-off-dark dark:text-off-white text-center">
          Waiting for {invite.host.name} to open the challenge…
        </p>
      )}

      {status === "error" && error && (
        <p className="text-sm text-red-light dark:text-red-dark text-center">
          {error}
        </p>
      )}

      <Button
        fullWidth
        size="lg"
        disabled={connecting || busy || !invite.hostOnline}
        onClick={accept}
      >
        {busy ? "Starting…" : "Accept challenge"}
      </Button>

      <Link
        href="/duel"
        className="text-xs text-lprimary dark:text-dprimary font-bold hover:underline"
      >
        Find a random match instead
      </Link>
    </div>
  );
}
