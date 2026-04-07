"use client";
import { DEFAULT_AVATAR } from "@/constants";
import { useEffect, useState, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/state/hooks";
import { setPlayers } from "@/state/admin/playersSlice";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ScreenStatus, setScreenStatus } from "@/state/admin/screenSlice";
import { resetTimer } from "@/state/timer/timerSlice";
import { RxCross2 } from "react-icons/rx";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ConfirmationModal from "./ConfirmationModal";
import { useAdminSocket } from "@/hooks/useAdminSocket";
import type { PlayerPayload } from "@/types/socket-events";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";

const Lobby = (params: {
  roomId: string;
  userId: string;
  gameCode: string;
  players: PlayerPayload[];
  currentQues: number;
  gameStarted: boolean;
  quizTitle: string;
  quizId: string;
}) => {
  const dispatch = useAppDispatch();
  const players = useAppSelector((state) => state.player.players);
  const socket = useAppSelector((state) => state.socket.socket);
  const [endGame, setEndGame] = useState(false);
  const [load, setLoad] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (params?.gameStarted) {
      dispatch(resetTimer(3));
      dispatch(setScreenStatus(ScreenStatus.wait));
      router.push(`/admin/game/${params.roomId}`);
    }

    dispatch(setPlayers(params.players));
  }, [dispatch, params.players, params.gameStarted, params.roomId, router]);

  const handleGameStarted = useCallback(() => {
    setLoad(false);
    dispatch(resetTimer(3));
    dispatch(setScreenStatus(ScreenStatus.wait));
    router.push(`/admin/game/${params.roomId}`);
  }, [dispatch, params.roomId, router]);

  useAdminSocket({
    userId: params.userId,
    gameCode: params.gameCode,
    onPlayerRemoved: (player) => {
      toast.error(`You have removed ${player.name}`);
    },
    onGameStarted: handleGameStarted,
  });

  function handlePlayerRemove(player: PlayerPayload) {
    if (!socket?.connected) {
      toast.error("Socket not connected. Please try again.");
      return;
    }
    socket.emit("remove-player", player, params.gameCode);
  }

  function handleGameStart() {
    if (!socket?.connected) {
      toast.error("Socket not connected. Please try again.");
      return;
    }
    setLoad(true);
    socket.emit("start-game", params.gameCode);
  }

  async function handleStopHosting() {
    if (!socket?.connected) {
      toast.error("Socket not connected. Please try again.");
      setEndGame(false);
      return;
    }

    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(() => {
        socket.off("game-session-ended", onEnded);
        toast.error("Could not end game session. Please try again.");
        setEndGame(false);
        resolve();
      }, 5000);

      function onEnded() {
        window.clearTimeout(timeout);
        setEndGame(false);
        router.push(`/admin/quiz/${params.quizId}`);
        resolve();
      }

      socket.once("game-session-ended", onEnded);
      socket.emit("end-game-session", params.gameCode);
    });
  }

  return (
    <>
      <Button
        size="sm"
        className="bg-red-light dark:bg-red-dark text-white dark:text-dark hover:bg-red-dark absolute right-4 md:right-8 top-4 z-10"
        onClick={() => setEndGame(true)}
      >
        Stop Hosting
      </Button>

      <div className="bg-white dark:bg-dark md:rounded-xl md:mx-8 py-10 my-4 h-[81vh] px-6 relative flex flex-col items-center">
        <h1 className="font-extrabold text-3xl md:text-4xl italic dark:text-white mb-6 text-center">
          {params?.quizTitle}
        </h1>

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
          className="cursor-pointer select-none bg-light-bg dark:bg-cardhover-dark border-2 border-lprimary dark:border-dprimary rounded-2xl px-12 py-10 text-center shadow-lg hover:scale-[1.02] transition-all duration-300"
        >
          <p className="text-sm tracking-[4px] text-gray-500 dark:text-gray-300 mb-3">
            ROOM CODE
          </p>

          <h2 className="text-5xl md:text-5xl font-extrabold tracking-[12px] text-lprimary dark:text-dprimary font-mono drop-shadow-lg">
            {params?.gameCode}
          </h2>

          <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
            Click to copy & share with players
          </p>
        </button>

        <div className="flex flex-wrap justify-center gap-6 mt-6">
          <span className="p-2 dark:text-white border border-lprimary dark:border-dprimary bg-light-bg dark:bg-cardhover-dark rounded-xl font-bold">
            Participants: {players.length}
          </span>

          <span className="p-2 dark:text-white border border-lprimary dark:border-dprimary bg-light-bg dark:bg-cardhover-dark rounded-xl font-bold">
            Join at: {process.env.NEXT_PUBLIC_APP_URL ?? "buzrr.in"}
          </span>
        </div>

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

      <ConfirmationModal
        open={endGame}
        setOpen={setEndGame}
        onClick={handleStopHosting}
        desc="Do you really want to stop this quiz session? This action cannot be undone."
      />
    </>
  );
};

export default Lobby;
