"use client";

import { ScreenStatus, setScreenStatus } from "@/state/admin/screenSlice";
import { BarPlot, ChartContainer } from "@mui/x-charts";
import { useEffect } from "react";
import { RxCross2 } from "react-icons/rx";
import { TiTick } from "react-icons/ti";
import { useDispatch, useSelector } from "react-redux";
import { Option } from "@prisma/client";
import { RootState } from "@/state/store";
import { setCurrIndex, setLeaderboard } from "@/state/admin/playersSlice";
import Image from "next/image";
import { resetTimer } from "@/state/timer/timerSlice";

export default function QuesResult(props: any) {
  const { currentQues, quizQuestions, gameCode, players } = props;
  const dispatch = useDispatch();
  const currIndex = useSelector(
    (state: RootState) => state.player.currentIndex,
  );
  const leaderboard = useSelector(
    (state: RootState) => state.player.leaderboard,
  );
  const allQuestions = quizQuestions?.questions;
  const question = allQuestions[currIndex];
  const result = useSelector((state: RootState) => state.player.quesResult);
  var response = 0;

  for (var i = 0; i < result.length; i++) response += result[i];

  const socket = props.socket;

  function handleNext() {
    console.log("123");
    dispatch(resetTimer(3));
    if (currIndex == allQuestions.length - 1) {
      socket.emit("final-leaderboard", gameCode);
      socket.on("displaying-final-leaderboard", (leaderboard: any[]) => {
        console.log("Final Leaderboard");
        dispatch(setLeaderboard(leaderboard));
        dispatch(setScreenStatus(ScreenStatus.leaderboard));
      });
    } else {
      socket.emit("change-question", gameCode, currIndex + 1);
      socket.on("question-changed", (index: number) => {
        dispatch(setCurrIndex(index));
        dispatch(setScreenStatus(ScreenStatus.wait));
        socket.emit("start-timer", gameCode);
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
            <Barchart result={result} options={question?.options} />
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
                                  lead.Player.profilePic ||
                                  "/images/avatar-1577909_1280.webp"
                                }
                                className="w-12 h-12 rounded-full"
                                width={40}
                                height={40}
                                alt="profile pic"
                              />
                            </span>
                            <span className="font-bold">
                              {lead.Player.name}
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
              {currIndex == allQuestions.length - 1
                ? "Final Leaderboard"
                : "Next Question"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Barchart(params: { result: number[]; options: Option[] }) {
  const uData = params?.result ? params?.result : [0, 0, 0, 0];
  const xLabels = ["Page A", "Page B", "Page C", "Page D"];
  const bars = document.getElementsByClassName(
    "MuiBarElement-root",
  ) as HTMLCollectionOf<HTMLElement>;

  useEffect(() => {
    if (bars.length >= 4) {
      var index = 0;
      for (var i = 0; i < params.options.length; i++) {
        if (params.options[i].isCorrect === true) index = i;
      }
      for (var i = 0; i < 4; i++) {
        bars[i].style.fill = "url(#gradient)";
        bars[i].style.borderRadius = "15px 0";
      }
    }
  }, [bars]);

  return (
    <>
      <svg width="0" height="0">
        <defs>
          <linearGradient id="gradient" gradientTransform="rotate(90)">
            <stop offset="0%" stopColor="#7D49F8" />
            <stop offset="100%" stopColor="#A589FC" />
          </linearGradient>
        </defs>
      </svg>
      <div className="overflow-hidden flex flex-col items-center ">
        <div className="relative top-[74px] z-10 w-fit">
          <ChartContainer
            width={550}
            height={300}
            series={[{ data: uData, label: "", type: "bar" }]}
            xAxis={[{ scaleType: "band", data: xLabels }]}
          >
            <BarPlot className="barplot" />
          </ChartContainer>
        </div>

        <div className="flex flex-row justify-around w-[450px] text-lg relative z-20 ">
          {params.result.length > 0 &&
            params.result.map((opt: any, index: number) => {
              const isCorrect = params.options[index].isCorrect === true;
              return (
                <div className="flex flex-col" key={index}>
                  <p className="flex flex-row items-center justify-center w-full">
                    {opt}
                    {isCorrect ? (
                      <TiTick
                        size={20}
                        color="#000"
                        className="text-dark dark:text-white font-extrabold ml-2"
                      />
                    ) : (
                      <RxCross2
                        size={20}
                        color="#000"
                        className="text-white font-extrabold ml-2"
                      />
                    )}
                  </p>
                  <div key={index} className="w-20 border-t">
                    <p className="text-sm dark:text-white font-semibold w-full text-center">
                      {index}.{" "}
                      {params.options[index].title.length > 15
                        ? `${params.options[index].title.slice(0, 15)}...`
                        : params.options[index].title}{" "}
                      option
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}
