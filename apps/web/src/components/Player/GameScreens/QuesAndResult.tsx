"use client";
import clsx from "clsx";
import Image from "next/image";
import { useEffect, useState } from "react";

const QuestionAndResult = (params: {
  question?: any;
  quizTitle: string;
  gameCode: string;
  screen: string;
  submitAnswer?: any;
  quesTime: number;
  optionId?: string;
  status?: string;
  message?: string;
}) => {
  const options = params?.question?.options;
  const [quesTime, setQuesTime] = useState(params?.quesTime);
  const [percent, setPercent] = useState(100);

  useEffect(() => {
    const timer = setInterval(() => {
      if (quesTime > 0) {
        setQuesTime((prev: number) => prev - 1);
      }
      if (quesTime >= 0) {
        var x = Math.floor((quesTime * 100) / params?.question?.timeOut);
        setPercent(x);
      }
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [quesTime, params.question]);

  function handleSubmit(id: string) {
    params?.submitAnswer(id);
  }

  return (
    <>
      {params.screen === "question" && (
        <div
          style={{
            width: `${percent}%`,
            transition: "width 1s linear",
          }}
          className="w-full h-2 dark:bg-dprimary bg-lprimary block md:hidden"
        ></div>
      )}
      <div className="w-full h-[85vh] flex gap-4 md:py-4 md:px-8 *:bg-white dark:*:bg-dark md:*:rounded-xl overflow-y-auto">
        <div className="hidden md:w-1/3 md:flex flex-col justify-between py-6 px-5 h-full">
          <div className="border-12 dark:border-lprimary border-dprimary light: rounded-full w-32 h-32 flex items-center justify-center mx-auto">
            <span className="font-semibold text-3xl dark:text-white">
              {quesTime}
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1 rounded-xl dark:bg-opacity-30 bg-opacity-30 bg-red-light dark:bg-red-dark w-fit p-1 py-[2px]">
              <div className="rounded-full w-3 h-3 bg-red-600"></div>
              <p className="text-xs text-red-light dark:text-red-dark">Live</p>
            </div>
            <p className="font-extrabold mt-2 mb-4 dark:text-white capitalize text-xl">
              {params.quizTitle}
            </p>
            <p className="dark:text-white mb-1">Room code: {params.gameCode}</p>
            <p className="dark:text-white mb-1">Quiz by</p>

            <div className="flex gap-2 items-center">
              <Image src="/images/SI.svg" width={48} height={48} alt="Logo" />
              <p className="dark:text-white">SDC-SI</p>
            </div>
          </div>
        </div>
        {params.screen === "question" ? (
          <div className="w-full p-6 flex flex-col min-h-full h-fit ">
            {params.question.mediaType === "image" && (
              <Image
                src={params.question.media}
                className="mb-10 mx-auto md:h-[30vh]"
                alt="media Image"
                height={320}
                width={500}
              />
            )}
            <p className="dark:text-white">Question</p>
            <p className="font-bold text-2xl dark:text-white">
              {params.question.title}
            </p>

            <div
              className={clsx("grid grid-cols-1 gap-x-4", params.question.mediaType === "image" ? "lg:grid-cols-2 my-2" : "my-4")}
            >
              {options.map((option: any, index: number) => {
                return (
                  <div
                    key={option.id}
                    className={clsx(
                    "cursor-pointer p-4 rounded-xl text-lg dark:text-white mt-4",
                    option.id === params.optionId ? "dark:bg-dprimary bg-lprimary" : "bg-light-bg dark:bg-off-dark"
                  )}
                    onClick={() => {
                      handleSubmit(option.id);
                    }}
                  >
                    {index + 1}. {option.title}
                  </div>
                );
              })}
            </div>

            <p className="dark:text-white mb-1 md:hidden font-bold text-center my-6 text-lg">
              Room code: {params.gameCode}
            </p>
          </div>
        ) : (
          <div className="w-full p-6 flex flex-col">
            <div className="flex flex-col justify-center items-center">
              <Image
                src={`${
                  params.status === "correct"
                    ? "/images/correct.svg"
                    : params.status === "incorrect"
                      ? "/images/incorrect.svg"
                      : "/images/timesOut.svg"
                }`}
                width={160}
                height={160}
                alt="Logo"
                className="w-1/2 h-1/2 md:w-2/5 md:h-2/5"
              />
              <p
                className={clsx(
                  "text-xl xl:text-3xl font-medium mt-2",
                  params.status === "correct" ? "text-[#20A97C]" : params.status === "incorrect" ? "text-red-dark" : "text-[#F2AB53]"
                )}
              >
                {params.message}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default QuestionAndResult;
