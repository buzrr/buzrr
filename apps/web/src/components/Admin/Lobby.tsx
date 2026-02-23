"use client";
import { DEFAULT_AVATAR } from "@/constants";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/state/store";
import { createConnection } from "@/state/socket/socketSlice";
import {
  addPlayer,
  removePlayer,
  setPlayers,
} from "@/state/admin/playersSlice";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ScreenStatus, setScreenStatus } from "@/state/admin/screenSlice";
import { resetTimer } from "@/state/timer/timerSlice";
import { RxCross2 } from "react-icons/rx";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ConfirmationModal from "./ConfirmationModal";

const Lobby = (params: {
  roomId: string;
  userId: string;
  gameCode: string;
  players: any[];
  quizQuestions: any;
  currentQues: number;
  gameStarted: boolean;
  quizTitle: string;
  quizId: string;
}) => {
  const dispatch = useDispatch();
  const players: any[] = useSelector(
    (state: RootState) => state.player.players,
  );
  const socket = useSelector((state: RootState) => state.socket.socket);
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

  useEffect(() => {
    if (window !== undefined) {
      const socket = io(
        `${process.env.NEXT_PUBLIC_SOCKET_URL}/?userType=admin&adminId=${params.userId}&gameCode=${params.gameCode}`,
      );
      socket.on("connect", () => {
        console.log("Connected to socket server");
        dispatch(createConnection(socket));
      });

      socket.on("player-joined", (player: any) => {
        console.log(`Player ${player.id} Joined`);
        dispatch(addPlayer(player));
      });

      socket.on("player-removed", (player: any) => {
        console.log(`Player ${player.id} removed`);
        dispatch(removePlayer(player));
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [dispatch, params.gameCode, params.userId, players]);

  function handlePlayerRemove(player: any) {
    socket.emit("remove-player", player, params.gameCode);
    socket.on("player-removed", (player: any) => {
      console.log(`Player ${player.id} removed`);
      dispatch(removePlayer(player));
      toast.error(`You have removed ${player.name}`);
    });
  }

  function handleGameStart() {
    setLoad(true);
    socket.emit("start-game", params.gameCode);
    socket.on("game-started", (gameCode: string) => {
      console.log("Game started");
      setLoad(false);
      dispatch(resetTimer(3));
      dispatch(setScreenStatus(ScreenStatus.wait));
      router.push(`/admin/game/${params.roomId}`);
    });
  }

  function handleModalOpen() {
    setEndGame(true);
  }

  function handleStopQuiz() {
    console.log("db");
    router.push(`/admin/quiz/${params.quizId}`);
  }

  return (
    <>
      <button
        className="text-white dark:text-dark bg-red-light dark:bg-red-dark p-2 w-fit rounded-lg absolute text-sm font-black hover:bg-red-dark right-4 md:right-8 top-4 transition-all z-10"
        onClick={handleModalOpen}
      >
        Stop Hosting
      </button>

      <div className="bg-white dark:bg-dark md:rounded-xl md:mx-8 py-10 my-4 h-[81vh] px-6 relative flex flex-col items-center">
        <h1 className="font-extrabold text-3xl md:text-4xl italic dark:text-white mb-6 text-center">
          {params?.quizTitle}
        </h1>

        <div
          onClick={() => {
            navigator.clipboard
              .writeText(params?.gameCode)
              .then(() => {
                toast.success("Room code copied!");
              })
              .catch((err) => {
                console.error(err);
                toast.error("Failed to copy room code");
              });
          }}
          className="cursor-pointer select-none bg-light-bg dark:bg-cardhover-dark border-2 border-[#7D49F8] rounded-2xl px-12 py-10 text-center shadow-lg hover:scale-[1.02] transition-all duration-300"
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
        </div>

        <div className="flex flex-wrap justify-center gap-6 mt-6">
          <span className="p-2 dark:text-white border border-[#7D49F8] bg-light-bg dark:bg-cardhover-dark rounded-xl font-bold">
            Participants: {players.length}
          </span>

          <span className="p-2 dark:text-white border border-[#7D49F8] bg-light-bg dark:bg-cardhover-dark rounded-xl font-bold">
            Join at: {process.env.NEXT_PUBLIC_APP_URL ?? "buzrr.in"}
          </span>
        </div>

        <div className="h-fit mt-8 mx-auto max-h-[40vh] flex flex-wrap justify-center overflow-y-auto gap-y-4 gap-x-3 w-full">
          {players.length === 0 ? (
            <div className="p-2 mx-auto w-fit dark:text-white text-lg">
              Waiting for players to join...
            </div>
          ) : (
            players.map((player: any) => {
              return (
                <div
                  key={player.id}
                  className="border flex justify-between items-center w-fit gap-3 rounded-full py-2 px-3 text-dark dark:text-white text-base shadow-sm"
                >
                  <Image
                    src={
                      (player.profilePic as string) ||
                      DEFAULT_AVATAR
                    }
                    width={40}
                    height={40}
                    alt="Profile"
                    className="rounded-full h-10 w-10"
                  />
                  {player.name}
                  <span
                    className="cursor-pointer font-bold text-lg hover:text-red-500 transition"
                    onClick={() => handlePlayerRemove(player)}
                  >
                    <RxCross2 size={20} />
                  </span>
                </div>
              );
            })
          )}
        </div>

        <button
          className="mt-10 rounded-xl text-white dark:text-dark bg-lprimary dark:bg-dprimary px-6 py-4 hover:cursor-pointer transition-all duration-300 ease-in-out disabled:cursor-default font-bold disabled:bg-gray dark:disabled:bg-gray w-64 sm:w-96 absolute bottom-10"
          disabled={players.length === 0 || load}
          onClick={handleGameStart}
        >
          {load === true ? "Loading..." : "Start Game"}
        </button>
      </div>

      <ConfirmationModal
        open={endGame}
        setOpen={setEndGame}
        onClick={handleStopQuiz}
        desc="Do you really want to stop this quiz session ? This action cannot be undone."
      />
    </>
  );
};

export default Lobby;
