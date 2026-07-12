"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useAppSelector } from "@/state/hooks";
import { useServerCountdown } from "@/hooks/useServerCountdown";
import { Button } from "@/components/ui/Button";
import type { GameSocket } from "@/types/socket-events";

interface QuestionScreenProps {
  gameCode: string;
  quizTitle?: string;
  socket: GameSocket;
}

/**
 * Renders the server-pushed question. The countdown is display-only — the
 * server ends the question at its own deadline; "Next" just asks the server
 * to skip ahead.
 */
export default function QuestionScreen(props: QuestionScreenProps) {
  const { gameCode, quizTitle, socket } = props;
  const question = useAppSelector((state) => state.game.question);
  const deadline = useAppSelector((state) => state.game.deadline);
  const clockOffset = useAppSelector((state) => state.game.clockOffset);
  const remaining = useServerCountdown(deadline, clockOffset);

  if (!question) return null;

  const options = question.options ?? [];

  return (
    <>
      <div className="flex items-center m-auto h-fit w-full md:mx-4 dark:text-white *:bg-white dark:*:bg-dark">
        <div className="h-full w-full md:w-1/3 lg:max-w-sm mx-2 hidden pt-8 md:block rounded-xl">
          <div className="flex justify-center">
            <Countdown
              key={question.id}
              duration={question.timeOut}
              remaining={remaining}
            />
          </div>
          <div className="pl-4 mt-2">
            <div className="text-red-light bg-[#f4d4d4] dark:bg-[#513232] rounded-full px-2 w-fit font-bold">
              &#9679; Live
            </div>
            <div className="text-2xl font-black">{quizTitle}</div>
          </div>
          <div className="mt-36 mb-2 pl-4">
            <div className="text-md">Room Code</div>
            <div className="text-4xl font-black">{gameCode}</div>
          </div>
        </div>
        <div className="h-full w-full md:mx-2 md:rounded-xl flex flex-col justify-center">
          <div className="text-center my-6 md:hidden">
            <div className="text-md">Room Code</div>
            <div className="text-2xl font-black">{gameCode}</div>
          </div>
          <div className="w-fit mx-auto rounded overflow-hidden">
            {question.mediaType === "image" && question.media && (
              <Image
                src={question.media}
                className="max-h-[30dvh] w-auto"
                alt="media Image"
                height={300}
                width={300}
              />
            )}
          </div>
          <div className="pl-4">Question</div>
          <h1 className="pb-6 pl-4 text-2xl font-black capitalize">
            {question.title}
          </h1>
          <div className="absolute bottom-2 md:bottom-10 right-12 w-fit">
            <Button
              className="w-24 h-10 rounded!"
              size="sm"
              onClick={() => socket.emit("host-next")}
            >
              Next
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full p-8 pl-4 h-fit">
            {options.length > 0 &&
              options.map((opt, index) => {
                return (
                  <p
                    key={opt.id}
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

// Lazy-load to keep react-countdown-circle-timer out of main admin bundle.
const CountdownCircleTimer = dynamic(
  () =>
    import("react-countdown-circle-timer").then((m) => ({
      default: m.CountdownCircleTimer,
    })),
  { ssr: false },
);

function Countdown(params: { duration: number; remaining: number }) {
  return (
    <div className="">
      <CountdownCircleTimer
        isPlaying
        duration={params.duration}
        initialRemainingTime={Math.min(params.remaining, params.duration)}
        colors={["#a589fc", "#F7B801", "#A30000"]}
        colorsTime={[10, 5, 0]}
        size={150}
        updateInterval={1}
      >
        {({ remainingTime }: { remainingTime: number }) => (
          <span className="text-2xl font-bold">{remainingTime}</span>
        )}
      </CountdownCircleTimer>
    </div>
  );
}
