"use client";
import clsx from "clsx";
import { DEFAULT_AVATAR } from "@/constants";
import { useEffect, useState, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/state/hooks";
import { removePlayer, setPlayers } from "@/state/admin/playersSlice";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { RxCross2 } from "react-icons/rx";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ConnectionStatusPill from "@/components/ConnectionStatusPill";
import { useAdminSocket } from "@/hooks/useAdminSocket";
import { useRemoveRoomPlayerMutation } from "@/lib/modules/game-sessions/hooks";
import type { PlayerPayload } from "@/types/socket-events";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import ShareRoom from "@/components/ShareRoom";
import { buildJoinUrl } from "@/lib/join-link";
import EndQuizButton from "@/components/Admin/EndQuizButton";

const Lobby = (params: {
  roomId: string;
  userId: string;
  gameCode: string;
  players: PlayerPayload[];
  currentQues: number;
  gameStarted: boolean;
  quizTitle: string;
  quizId: string;
  maxPlayers?: number;
}) => {
  const dispatch = useAppDispatch();
  const players = useAppSelector((state) => state.player.players);
  const maxPlayers = params.maxPlayers ?? 50;
  const [load, setLoad] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (params?.gameStarted) {
      router.push(`/admin/game/${params.roomId}`);
    }

    dispatch(setPlayers(params.players));
  }, [dispatch, params.players, params.gameStarted, params.roomId, router]);

  const handleGameStarted = useCallback(() => {
    setLoad(false);
    router.push(`/admin/game/${params.roomId}`);
  }, [params.roomId, router]);

  const { socket } = useAdminSocket({
    gameCode: params.gameCode,
    onPlayerRemoved: (player) => {
      toast.error(`You have removed ${player.name ?? "the player"}`);
    },
    onGameStarted: handleGameStarted,
  });

  const removePlayerMutation = useRemoveRoomPlayerMutation();

  // Kick and stop-hosting go over HTTP so they work even while the socket is
  // down; the server broadcasts the resulting events to everyone connected.
  function handlePlayerRemove(player: PlayerPayload) {
    removePlayerMutation.mutate(
      { roomId: params.roomId, playerId: player.id },
      {
        onSuccess: () => {
          // Connected clients get the player-removed broadcast; update
          // locally in case ours is down (the reducer is idempotent).
          dispatch(removePlayer({ id: player.id }));
          if (!socket?.connected) {
            toast.error(`You have removed ${player.name ?? "the player"}`);
          }
        },
        onError: () => {
          toast.error("Could not remove player. Please try again.");
        },
      },
    );
  }

  function handleGameStart() {
    if (!socket?.connected) {
      toast.error("Not connected to the game server yet. Please wait.");
      return;
    }
    setLoad(true);
    socket.emit("start-game", params.gameCode);
    // Move to the game screen right away instead of waiting for the
    // `game-started` round-trip — it syncs the countdown over the socket on
    // connect, so the host isn't stranded on the lobby while the server spins
    // up the game. `onGameStarted` remains a backup navigation.
    router.push(`/admin/game/${params.roomId}`);
  }

  return (
    <>
      <EndQuizButton
        roomId={params.roomId}
        redirectTo={`/admin/quiz/${params.quizId}`}
      />

      <div className="bg-white dark:bg-dark md:rounded-xl md:mx-8 py-6 md:py-10 my-4 min-h-[81dvh] px-6 relative flex flex-col items-center overflow-y-auto">
        <div className="absolute left-4 top-4 z-10 flex flex-col items-start gap-2">
          <ConnectionStatusPill />
          <span
            className={clsx(
              "px-2 py-1 text-xs md:text-sm dark:text-white border rounded-xl font-bold bg-light-bg dark:bg-cardhover-dark",
              players.length >= maxPlayers
                ? "border-red-light dark:border-red-dark"
                : "border-lprimary dark:border-dprimary",
            )}
          >
            Participants: {players.length} / {maxPlayers}
          </span>
        </div>

        <h1 className="font-extrabold text-2xl md:text-4xl italic dark:text-white mb-4 md:mb-6 mt-8 md:mt-0 text-center">
          {params?.quizTitle}
        </h1>

        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                .writeText(params?.gameCode)
                .then(() => {
                  toast.success("Room code copied!");
                })
                .catch(() => {
                  toast.error("Failed to copy room code");
                });
            }}
            className="cursor-pointer select-none bg-light-bg dark:bg-cardhover-dark border-2 border-lprimary dark:border-dprimary rounded-2xl px-8 py-6 md:px-12 md:py-8 text-center shadow-lg hover:scale-[1.02] transition-all duration-300"
          >
            <p className="text-sm tracking-[4px] text-gray-500 dark:text-gray-300 mb-2 md:mb-3">
              ROOM CODE
            </p>

            <h2 className="text-4xl md:text-5xl font-extrabold tracking-[12px] text-lprimary dark:text-dprimary font-mono drop-shadow-lg">
              {params?.gameCode}
            </h2>

            <p className="mt-2 md:mt-3 text-sm text-stone-500 dark:text-stone-400">
              Click to copy & share with players
            </p>
          </button>

          <ShareRoom url={buildJoinUrl(params.gameCode)} variant="full" />
        </div>

        <p className="mt-4 md:mt-6 text-xs text-stone-500 dark:text-stone-400 text-center max-w-md">
          Rooms are capped at {maxPlayers} players while Buzrr is in beta on
          free-tier infrastructure.
        </p>

        <div className="h-fit mt-8 mx-auto max-h-[40vh] flex flex-wrap justify-center overflow-y-auto gap-y-4 gap-x-3 w-full">
          {players.length === 0 ? (
            <div className="p-2 mx-auto w-fit dark:text-white text-lg">
              Waiting for players to join...
            </div>
          ) : (
            players.map((player) => (
              <div
                key={player.id}
                className="border flex justify-between items-center w-fit gap-3 rounded-full py-2 px-3 text-dark dark:text-white text-base shadow-sm"
              >
                <Image
                  src={player.profilePic || DEFAULT_AVATAR}
                  width={40}
                  height={40}
                  alt="Profile"
                  className="rounded-full h-10 w-10"
                />
                {player.name}
                <IconButton
                  aria-label={`Remove ${player.name}`}
                  className="cursor-pointer font-bold text-lg hover:text-red-500 transition"
                  onClick={() => handlePlayerRemove(player)}
                  icon={<RxCross2 size={20} />}
                />
              </div>
            ))
          )}
        </div>

        <Button
          className="mt-10 w-64 sm:w-96 absolute bottom-10"
          disabled={players.length === 0 || load || !socket?.connected}
          isLoading={load}
          loadingText="Loading..."
          onClick={handleGameStart}
        >
          Start Game
        </Button>
      </div>
    </>
  );
};

export default Lobby;
