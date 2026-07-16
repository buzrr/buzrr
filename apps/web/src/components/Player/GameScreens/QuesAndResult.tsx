"use client";
import clsx from "clsx";
import Image from "next/image";
import { useAppSelector } from "@/state/hooks";
import { useServerCountdown } from "@/hooks/useServerCountdown";
import CountdownRing from "@/components/CountdownRing";

interface QuestionOption {
  id: string;
  title: string;
}

interface QuestionWithOptions {
  id?: string;
  title?: string;
  timeOut?: number;
  media?: string | null;
  mediaType?: string | null;
  options?: QuestionOption[];
}

const QuestionAndResult = (params: {
  question?: QuestionWithOptions;
  quizTitle: string;
  gameCode: string;
  screen: string;
  submitAnswer?: (optionId: string) => void;
  optionId?: string;
  locked?: boolean;
  status?: string;
  message?: string;
}) => {
  const options = params?.question?.options ?? [];
  const deadline = useAppSelector((state) => state.game.deadline);
  const clockOffset = useAppSelector((state) => state.game.clockOffset);
  const connection = useAppSelector((state) => state.game.connection);
  // Answers submitted while offline would be rejected anyway — lock the UI.
  const offline = connection !== "connected";
  // Display-only countdown against the server deadline; the reveal is pushed
  // by the server regardless of what this shows.
  const remaining = useServerCountdown(deadline, clockOffset);
  const timeOut = params?.question?.timeOut ?? 1;
  const percent = Math.max(
    0,
    Math.min(100, Math.floor((remaining * 100) / timeOut)),
  );

  function handleSubmit(id: string) {
    if (params.locked || offline) return;
    params?.submitAnswer?.(id);
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
      <div className="w-full h-[85dvh] flex gap-4 md:py-4 md:px-8 *:bg-white dark:*:bg-dark md:*:rounded-xl overflow-y-auto">
        <div className="hidden md:w-1/3 md:flex flex-col justify-between py-6 px-5 h-full">
          <div className="flex items-center justify-center mx-auto">
            {params.screen === "question" ? (
              <CountdownRing
                key={params.question?.id ?? params.question?.title}
                duration={timeOut}
                remaining={remaining}
                size={128}
              />
            ) : (
              <div className="border-12 dark:border-lprimary border-dprimary rounded-full w-32 h-32 flex items-center justify-center">
                <span className="font-semibold text-3xl dark:text-white">
                  0
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1 rounded-xl bg-green-100 dark:bg-green-900/40 w-fit p-1 py-[2px]">
              <div className="rounded-full w-3 h-3 bg-green-500"></div>
              <p className="text-xs text-green-600 dark:text-green-400">Live</p>
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
            {params.question?.mediaType === "image" && (
              <Image
                src={params.question?.media ?? ""}
                className="mb-10 mx-auto md:h-[30vh]"
                alt="media Image"
                height={320}
                width={500}
              />
            )}
            <p className="dark:text-white">Question</p>
            <p className="font-bold text-2xl dark:text-white">
              {params.question?.title ?? ""}
            </p>

            <div
              className={clsx(
                "grid grid-cols-1 sm:grid-cols-2 gap-x-4",
                params.question?.mediaType === "image" ? "my-2" : "my-4",
              )}
            >
              {options.map((option: QuestionOption, index: number) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={offline || params.locked}
                  className={clsx(
                    "cursor-pointer p-4 rounded-xl text-lg dark:text-white mt-4 text-left w-full",
                    option.id === params.optionId
                      ? "dark:bg-dprimary bg-lprimary"
                      : "bg-light-bg dark:bg-off-dark",
                    (offline ||
                      (params.locked && option.id !== params.optionId)) &&
                      "opacity-50 cursor-default",
                  )}
                  onClick={() => handleSubmit(option.id)}
                  aria-pressed={option.id === params.optionId}
                >
                  {index + 1}. {option.title}
                </button>
              ))}
            </div>

            {params.locked && (
              <p className="dark:text-white text-center font-bold my-2">
                Answer received — waiting for the results…
              </p>
            )}

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
                  params.status === "correct"
                    ? "text-[#20A97C]"
                    : params.status === "incorrect"
                      ? "text-red-dark"
                      : "text-[#F2AB53]",
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
