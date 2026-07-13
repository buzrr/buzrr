"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { DEFAULT_AVATAR } from "@/constants";
import { useAppSelector } from "@/state/hooks";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import type { GameSocket } from "@/types/socket-events";

// Lazy-load chart to keep @mui/x-charts out of main bundle until result screen is shown.
const Barchart = dynamic(
  () => import("./QuesResultChart").then((m) => m.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] w-full max-w-[550px] animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
    ),
  },
);

interface QuesResultProps {
  socket: GameSocket;
}

/**
 * Per-question results. All data (answer counts, running leaderboard,
 * whether this was the last question) is pushed by the server; "Next" is a
 * single pacing intent — the server decides what follows.
 */
export default function QuesResult(props: QuesResultProps) {
  const { socket } = props;
  const question = useAppSelector((state) => state.game.question);
  const reveal = useAppSelector((state) => state.game.reveal);
  const leaderboard = useAppSelector((state) => state.game.leaderboard);
  const players = useAppSelector((state) => state.game.players);
  const qIndex = useAppSelector((state) => state.game.qIndex);
  const qCount = useAppSelector((state) => state.game.qCount);
  const [advancing, setAdvancing] = useState(false);

  const counts = reveal?.counts ?? [];
  const response = counts.reduce((sum, c) => sum + c, 0);
  const isLastQuestion = qIndex === qCount - 1;
  const connectedById = new Map(players.map((p) => [p.id, p.connected]));

  return (
    <>
      <div className="px-5">
        <div className="grid gap-y-4 md:grid-cols-2 md:gap-y-0 md:gap-x-4 w-full m-auto h-full">
          <div className="flex flex-col p-6 rounded-xl bg-white dark:bg-dark md:h-[83dvh]">
            <p className="font-extrabold text-2xl mb-3 dark:text-white">
              {response} Responses
              <span className="font-normal ml-1 text-base">
                /{players.length}
              </span>{" "}
            </p>
            <p className="capitalize text-dark dark:text-white">
              <span className="font-semibold">Question:</span> {question?.title}
            </p>
            <Barchart
              result={counts}
              options={question?.options ?? []}
              correctOptionIds={reveal?.correctOptionIds ?? []}
            />
          </div>

          <div className="md:rounded-xl ">
            <div className="bg-white dark:bg-dark p-6 w-full h-[72dvh] mb-4 rounded-xl">
              <p className="font-extrabold text-2xl mb-5 dark:text-white">
                Leaderboard
              </p>
              <div className="h-[90%] overflow-y-auto">
                {leaderboard.length > 0
                  ? leaderboard.map((lead) => {
                      return (
                        <div
                          className="flex justify-between items-center mb-3 text-dark dark:text-white"
                          key={lead.playerId}
                        >
                          <div className="flex gap-x-3 items-center">
                            <span>{lead.rank}. </span>
                            <span className="relative">
                              <Image
                                src={lead.profilePic || DEFAULT_AVATAR}
                                className="w-12 h-12 rounded-full"
                                width={40}
                                height={40}
                                alt="profile pic"
                              />
                              <span
                                title={
                                  connectedById.get(lead.playerId)
                                    ? "Connected"
                                    : "Disconnected"
                                }
                                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border border-white ${
                                  connectedById.get(lead.playerId)
                                    ? "bg-green-500"
                                    : "bg-gray"
                                }`}
                              />
                            </span>
                            <span className="font-bold">{lead.name}</span>
                          </div>
                          <p>{lead.score}</p>
                        </div>
                      );
                    })
                  : null}
              </div>
            </div>
            <Button
              fullWidth
              disabled={advancing}
              onClick={() => {
                setAdvancing(true);
                socket.emit("host-next");
              }}
            >
              {isLastQuestion ? "Final Leaderboard" : "Next Question"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
