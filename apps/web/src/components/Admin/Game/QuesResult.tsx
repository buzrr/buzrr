"use client";

import dynamic from "next/dynamic";
import { DEFAULT_AVATAR } from "@/constants";
import { ScreenStatus, setScreenStatus } from "@/state/admin/screenSlice";
import { useDispatch, useSelector } from "react-redux";
import type { Option } from "@/types/db";
import { RootState } from "@/state/store";
import { setCurrIndex, setLeaderboard, type LeaderboardEntry } from "@/state/admin/playersSlice";
import Image from "next/image";
import { resetTimer } from "@/state/timer/timerSlice";

// Lazy-load chart to keep @mui/x-charts out of main bundle until result screen is shown.
const Barchart = dynamic(
  () => import("./QuesResultChart").then((m) => m.default),
  { ssr: false, loading: () => <div className="h-[300px] w-[550px] animate-pulse rounded bg-gray-200 dark:bg-gray-700" /> }
);

interface QuesResultProps {
  quizQuestions?: { questions?: { title?: string; options?: Option[] }[] };
  gameCode: string;
  players?: unknown[];
  socket: { emit: (e: string, ...args: unknown[]) => void; on: (e: string, cb: (data: unknown) => void) => void };
}

export default function QuesResult(props: QuesResultProps) {
  const { quizQuestions, gameCode, players } = props;
  const dispatch = useDispatch();
  const currIndex = useSelector(
    (state: RootState) => state.player.currentIndex,
  );
  const leaderboard = useSelector(
    (state: RootState) => state.player.leaderboard,
  );
  const allQuestions = quizQuestions?.questions ?? [];
  const question = allQuestions[currIndex];
  const result = useSelector((state: RootState) => state.player.quesResult);
  let response = 0;

  for (let i = 0; i < result.length; i++) response += result[i];

  const socket = props.socket;

  function handleNext() {
    dispatch(resetTimer(3));
    if (currIndex == allQuestions.length - 1) {
      socket.emit("final-leaderboard", gameCode);
      socket.on("displaying-final-leaderboard", (data: unknown) => {
        dispatch(setLeaderboard(data as LeaderboardEntry[]));
        dispatch(setScreenStatus(ScreenStatus.leaderboard));
      });
    } else {
      socket.emit("change-question", gameCode, currIndex + 1);
      socket.on("question-changed", (data: unknown) => {
        if(typeof data === "number") {
          dispatch(setCurrIndex(data));
          dispatch(setScreenStatus(ScreenStatus.wait));
          socket.emit("start-timer", gameCode);
        }
      });
    }
  }
  return (
    <>
      <div className="px-5">
        <div className="grid gap-y-4 md:grid-cols-2 md:gap-y-0 md:gap-x-4 w-full m-auto h-full">
          <div className="flex flex-col p-6 rounded-xl bg-white dark:bg-dark h-[83vh]">
            <p className="font-extrabold text-2xl mb-3 dark:text-white">
              {response} Responses
              <span className="font-normal ml-1 text-base">
                /{players?.length}
              </span>{" "}
            </p>
            <p className="capitalize text-dark dark:text-white">
              <span className="font-semibold">Question:</span> {question?.title}
            </p>
            <Barchart result={result} options={question?.options ?? []} />
          </div>

          <div className="md:rounded-xl ">
            <div className="bg-white dark:bg-dark p-6 w-full h-[72vh] mb-4 rounded-xl">
              <p className="font-extrabold text-2xl mb-5 dark:text-white">
                Leaderboard
              </p>
              <div className="h-[90%] overflow-y-auto">
                {leaderboard?.length > 0
                  ? leaderboard.map((lead, index) => {
                      return (
                        <div
                          className="flex justify-between items-center mb-3 text-dark dark:text-white"
                          key={index}
                        >
                          <div className="flex gap-x-3 items-center">
                            <span>{index + 1}. </span>
                            <span>
                              {" "}
                              <Image
                                src={
                                  lead.Player?.profilePic ||
                                  DEFAULT_AVATAR
                                }
                                className="w-12 h-12 rounded-full"
                                width={40}
                                height={40}
                                alt="profile pic"
                              />
                            </span>
                            <span className="font-bold">
                              {lead.Player?.name}
                            </span>
                          </div>
                          <p>{lead.score}</p>
                        </div>
                      );
                    })
                  : null}
              </div>
            </div>
            <button
              className="rounded-xl text-white dark:text-dark w-full bg-lprimary dark:bg-dprimary px-5 py-3 hover:cursor-pointer transition-all duration-300 ease-in-out disabled:cursor-default font-bold disabled:bg-gray"
              onClick={handleNext}
            >
              {currIndex == (allQuestions?.length ?? 0) - 1
                ? "Final Leaderboard"
                : "Next Question"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
