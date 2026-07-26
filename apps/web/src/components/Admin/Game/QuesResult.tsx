"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { DEFAULT_AVATAR } from "@/constants";
import { useAppDispatch, useAppSelector } from "@/state/hooks";
import Image from "next/image";
import { LuBan, LuUserMinus } from "react-icons/lu";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import { playerRemoved } from "@/state/game/gameSlice";
import {
  useBanRoomPlayerMutation,
  useRemoveRoomPlayerMutation,
} from "@/lib/modules/game-sessions/hooks";
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
  roomId: string;
}

/**
 * Per-question results. All data (answer counts, running leaderboard,
 * whether this was the last question) is pushed by the server; "Next" is a
 * single pacing intent — the server decides what follows.
 *
 * The leaderboard doubles as the host's moderation surface: every row can be
 * kicked (removed from this round, free to rejoin with the room code) or
 * banned (removed and blocked from rejoining this room).
 */
export default function QuesResult(props: QuesResultProps) {
  const { socket, roomId } = props;
  const dispatch = useAppDispatch();
  const question = useAppSelector((state) => state.game.question);
  const reveal = useAppSelector((state) => state.game.reveal);
  const leaderboard = useAppSelector((state) => state.game.leaderboard);
  const players = useAppSelector((state) => state.game.players);
  const qIndex = useAppSelector((state) => state.game.qIndex);
  const qCount = useAppSelector((state) => state.game.qCount);
  const [advancing, setAdvancing] = useState(false);
  const [playerToBan, setPlayerToBan] = useState<{
    playerId: string;
    name: string;
  } | null>(null);

  const removePlayerMutation = useRemoveRoomPlayerMutation();
  const banPlayerMutation = useBanRoomPlayerMutation();

  const counts = reveal?.counts ?? [];
  const response = counts.reduce((sum, c) => sum + c, 0);
  const isLastQuestion = qIndex === qCount - 1;
  const connectedById = new Map(players.map((p) => [p.id, p.connected]));

  // Kick and ban go over HTTP so they work even while the host socket is down;
  // the server broadcasts player-removed and a fresh leaderboard to the room.
  function handleKick(playerId: string, name: string) {
    removePlayerMutation.mutate(
      { roomId, playerId },
      {
        onSuccess: () => {
          dispatch(playerRemoved({ playerId }));
          toast.success(`You have removed ${name}`);
        },
        onError: () =>
          toast.error("Could not remove player. Please try again."),
      },
    );
  }

  function handleBan() {
    if (!playerToBan) return;
    const { playerId, name } = playerToBan;
    banPlayerMutation.mutate(
      { roomId, playerId },
      {
        onSuccess: () => {
          dispatch(playerRemoved({ playerId }));
          setPlayerToBan(null);
          toast.success(`You have banned ${name}`);
        },
        onError: () => toast.error("Could not ban player. Please try again."),
      },
    );
  }

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
                          <div className="flex items-center gap-x-1">
                            <p>{lead.score}</p>
                            <IconButton
                              aria-label={`Remove ${lead.name} from this game`}
                              title="Kick — can rejoin with the room code"
                              disabled={removePlayerMutation.isPending}
                              className="cursor-pointer text-off-dark dark:text-off-white hover:text-red-500 dark:hover:text-red-500 transition"
                              onClick={() =>
                                handleKick(lead.playerId, lead.name)
                              }
                              icon={<LuUserMinus size={18} />}
                            />
                            <IconButton
                              aria-label={`Ban ${lead.name} from this room`}
                              title="Ban — blocked from rejoining this room"
                              className="cursor-pointer text-off-dark dark:text-off-white hover:text-red-500 dark:hover:text-red-500 transition"
                              onClick={() =>
                                setPlayerToBan({
                                  playerId: lead.playerId,
                                  name: lead.name,
                                })
                              }
                              icon={<LuBan size={18} />}
                            />
                          </div>
                        </div>
                      );
                    })
                  : null}
              </div>
            </div>

            <ConfirmationModal
              open={playerToBan !== null}
              setOpen={(open) => {
                if (!open) setPlayerToBan(null);
              }}
              onClick={handleBan}
              desc={`${playerToBan?.name ?? "This player"} will be removed and blocked from rejoining this room. The ban lasts until this room ends.`}
              confirmLabel="Ban Player"
              confirming={banPlayerMutation.isPending}
              confirmingLabel="Banning…"
            />
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
