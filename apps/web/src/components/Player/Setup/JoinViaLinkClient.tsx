"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CreatePlayerForm from "@/components/Player/Setup/CreatePlayerForm";
import ResetReduxStates from "@/components/Player/ResetReduxStates";
import clsx from "clsx";
import JoinShell from "@/components/Player/Setup/JoinShell";
import ProfilePreview from "@/components/Player/Setup/ProfilePreview";
import { PROFILES } from "@/components/Player/SelectProfile";
import { mutedText } from "@/components/Game/GameUI";

/**
 * Link/QR entry point. The room code is carried by the URL, so the player only
 * enters a name and is joined straight into the game (no room-code step). A
 * manual-join fallback stays available for invalid/expired links.
 */
export default function JoinViaLinkClient({ gameCode }: { gameCode: string }) {
  // Codes are uppercase, whitespace-free (see JoinRoomForm) — normalize the
  // raw URL segment so a typed/lower-cased link still resolves.
  const normalizedCode = useMemo(
    () => gameCode.replace(/\s/g, "").toUpperCase(),
    [gameCode],
  );

  const [data, setData] = useState({
    name: "",
    image: PROFILES[0],
  });

  return (
    <>
      {/* A link join is always a fresh game — clear any stale room state. */}
      <ResetReduxStates />
      <JoinShell
        form={
          <>
            <CreatePlayerForm
              data={data}
              setData={setData}
              joinGameCode={normalizedCode}
            />
            <p className={clsx("text-sm", mutedText)}>
              Having trouble?{" "}
              <Link
                href="/player"
                className="font-semibold text-lprimary dark:text-dprimary hover:underline"
              >
                Join with a room code instead
              </Link>
            </p>
          </>
        }
        preview={<ProfilePreview name={data.name} image={data.image} />}
      />
    </>
  );
}
