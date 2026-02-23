"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/state/store";
import { setTimer } from "@/state/timer/timerSlice";
import { Socket } from "socket.io-client";
import { ScreenStatus, setScreenStatus } from "@/state/admin/screenSlice";

export default function WaitScreen(params: {
  currentQues: number;
  socket: Socket;
  gameCode: string;
}) {
  const dispatch = useDispatch();
  const time = useSelector((state: RootState) => state.timer.value);
  const currIndex = useSelector(
    (state: RootState) => state.player.currentIndex,
  );
  const [start, setStart] = useState(false);
  const socket = params.socket;

  useEffect(() => {
    const handleQuestionIndex = () => {
      dispatch(setScreenStatus(ScreenStatus.question));
    };
    const handleTimerStarts = () => {
      console.log("Timer started");
      setStart(true);
    };

    socket.on("get-question-index", handleQuestionIndex);
    socket.on("timer-starts", handleTimerStarts);

    return () => {
      socket.off("get-question-index", handleQuestionIndex);
      socket.off("timer-starts", handleTimerStarts);
    };
  }, [socket, dispatch]);

  useEffect(() => {
    if (start || currIndex != 0) {
      const timer = setInterval(() => {
        if (time >= 0) {
          dispatch(setTimer());
        }
      }, 1000);

      if (time < 0) {
        socket.emit("set-question-index", params.gameCode, currIndex);
      }

      return () => {
        clearInterval(timer);
      };
    }
  }, [time, currIndex, dispatch, params.gameCode, socket, start]);

  function handleSocket() {
    socket.emit("start-timer", params.gameCode);
  }

  return (
    <>
      <div className="w-[100vw] h-[100vh] bg-lprimary dark:bg-dprimary absolute top-0 flex flex-col-reverse pb-8 justify-center items-center">
        {!start && currIndex == 0 && (
          <button
            onClick={() => handleSocket()}
            className="w-24 h-10 shadow hover:scale-105 transition-all bg-white dark:bg-dark border rounded"
          >
            Start Quiz
          </button>
        )}
        {(start || currIndex != 0) && (
          <div className="flex flex-col justify-center items-center text-dark dark:text-white w-full container h-32 m-auto">
            <span
              className="overflow-hidden animate-ping text-7xl font-semibold text-white dark:text-dark-bg overscroll-none"
              id="countdown"
            >
              {time === 0 && "LESGOOO"}
            </span>
            <span
              className="overflow-hidden animate-ping text-7xl font-semibold overscroll-none text-white dark:text-dark-bg"
              id="countdown"
            >
              {time > 0 && time}
            </span>
          </div>
        )}
        <span className="bg-white dark:bg-dark-bg w-10 h-10 rounded-full absolute top-[13vh] left-[15vw] md:left-[30vw] animate-pulse" />
        <span className="bg-white dark:bg-dark-bg w-8 h-8 rounded-full absolute bottom-[12vh] left-[20vw] md:left-[38vw] animate-pulse" />
        <span className="bg-white dark:bg-dark-bg w-4 h-4 rounded-full absolute bottom-[18vh] right-[20vw] md:right-[30vw] animate-pulse" />
        <span className="bg-white dark:bg-dark-bg w-6 h-6 rounded-full absolute top-[45vh] right-[32vw] animate-pulse hidden md:block" />
        <span className="bg-white dark:bg-dark-bg w-8 h-8 rounded-full absolute top-[8vh] right-[25vw] animate-pulse" />
      </div>
    </>
  );
}
