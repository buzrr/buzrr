"use client";

import { RootState } from "@/state/store";
import { CountdownCircleTimer } from "react-countdown-circle-timer";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ScreenStatus, setScreenStatus } from "@/state/admin/screenSlice";
import { setLeaderboard, setResult } from "@/state/admin/playersSlice";
import Image from "next/image";
import ShowLeaderboard from "@/actions/ShowLeaderboardAction";

export default function QuestionScreen(props: any) {
  const { currentQues, quizQuestions, gameCode } = props;
  const dispatch = useDispatch();
  const currIndex = useSelector(
    (state: RootState) => state.player.currentIndex,
  );
  const quizTitle = quizQuestions?.title;
  const allQuestions = quizQuestions?.questions;
  const socket = props.socket;
  const question = allQuestions[currIndex];
  const [time, setTime] = useState(question?.timeOut);

  async function handleNext() {
    const leaderboard = await ShowLeaderboard(gameCode);
    dispatch(setLeaderboard(leaderboard));
    socket.emit("display-result", gameCode, question?.id, question?.options);
    socket.on("displaying-result", (data: any) => {
      console.log("Displaying result", JSON.stringify(data));
      dispatch(setResult(data?.presenter));
      dispatch(setScreenStatus(ScreenStatus.result));
    });
  }
  useEffect(() => {
    if (time == 0) {
      handleNext();
    }
  }, [time]);

  return (
    <>
      <div className="flex items-center m-auto h-fit w-full md:mx-4 dark:text-white *:bg-white dark:*:bg-dark">
        <div className="h-full w-[30vw] mx-2 hidden pt-8 md:block rounded-xl">
          <div className="flex justify-center">
            <Countdown timer={question?.timeOut} setTime={setTime} />
          </div>
          <div className="pl-4 mt-2">
            <div className="text-red-light bg-[#f4d4d4] dark:bg-[#513232] rounded-full px-2 w-fit font-bold">
              &#9679; Live
            </div>
            <div className="text-2xl font-black">{quizTitle}</div>
          </div>
          <div className="mt-36 mb-2 pl-4">
            <div className="text-md">Room Code</div>
            <div className="text-4xl font-black">{props.gameCode}</div>
          </div>
        </div>
        <div className="h-full w-full md:mx-2 md:rounded-xl flex flex-col justify-center">
          <div className="text-center my-6 md:hidden">
            <div className="text-md">Room Code</div>
            <div className="text-2xl font-black">{props.gameCode}</div>
          </div>
          <div className="w-fit mx-auto rounded overflow-hidden">
            {question.mediaType === "image" && (
              <Image
                src={question.media}
                className="h-[25vh] w-auto"
                alt="media Image"
                height={300}
                width={300}
              />
            )}
          </div>
          <div className="pl-4">Question</div>
          <h1 className="pb-6 pl-4 text-2xl font-black capitalize">
            {question?.title}
          </h1>
          <div className="absolute bottom-2 md:bottom-10 right-12 w-fit">
            <button
              className="w-24 h-10 font-black bg-lprimary text-white dark:bg-dprimary dark:text-dark rounded"
              onClick={handleNext}
            >
              Next
            </button>
          </div>
          <div className="flex flex-col md:grid md:grid-cols-2 gap-6 w-full p-8 pl-4 h-fit">
            {question.options.length > 0 &&
              question.options.map((opt: any, index: number) => {
                return (
                  <p
                    key={index}
                    className="text-dark dark:text-white bg-light-bg dark:bg-dark-bg  p-4 rounded-xl"
                  >
                    {index + 1}
                    {". "}
                    {opt.title}
                  </p>
                );
              })}
          </div>
        </div>
      </div>
    </>
  );
}

function Countdown(params: { timer: number; setTime: any }) {
  return (
    <div className="">
      <CountdownCircleTimer
        isPlaying
        duration={params?.timer}
        colors={["#a589fc", "#F7B801", "#A30000"]}
        colorsTime={[10, 5, 0]}
        size={150}
        updateInterval={1}
        onUpdate={(remainingTime: number) => params.setTime(remainingTime)}
      >
        {({ remainingTime }) => (
          <span className="text-2xl font-bold">{remainingTime}</span>
        )}
      </CountdownCircleTimer>
    </div>
  );
}
