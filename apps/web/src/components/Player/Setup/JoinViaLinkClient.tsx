"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import CreatePlayerForm from "@/components/Player/Setup/CreatePlayerForm";
import ResetReduxStates from "@/components/Player/ResetReduxStates";
import ClientImage from "@/components/ClientImage";
import BackNavButton from "@/components/BackNavButton";

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
    // Must match the default in SelectProfile so `profile` validates upfront.
    image: "/images/player_profile/profile1.png",
  });

  return (
    <>
      {/* A link join is always a fresh game — clear any stale room state. */}
      <ResetReduxStates />
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-4 flex justify-between">
          <ClientImage
            props={{
              src: "/images/logo.svg",
              darksrc: "/images/logo-dark.svg",
              alt: "Buzrr Logo",
              width: 80,
              height: 80,
            }}
          />
        </div>
        <div className="w-full min-h-[81vh] md:h-[81vh] flex gap-4 pb-4 md:pb-0 *:bg-white dark:*:bg-dark *:rounded-xl">
          <div className="w-full mx-auto md:w-[60vw] flex flex-col p-4 sm:p-6">
            <div className="self-start">
              <BackNavButton href="/" />
            </div>
            <div className="flex-1 flex items-center justify-center py-8 md:py-4">
              <div className="w-full max-w-xl animate-fade-up">
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  Joining room{" "}
                  <span className="font-mono font-bold tracking-widest text-lprimary dark:text-dprimary">
                    {normalizedCode}
                  </span>
                </p>
                <CreatePlayerForm
                  data={data}
                  setData={setData}
                  joinGameCode={normalizedCode}
                />
                <p className="mt-6 text-sm text-stone-500 dark:text-stone-400">
                  Having trouble?{" "}
                  <Link
                    href="/player"
                    className="font-semibold text-lprimary dark:text-dprimary underline underline-offset-2"
                  >
                    Join with a room code instead
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
