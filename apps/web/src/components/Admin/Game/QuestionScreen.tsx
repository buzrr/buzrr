"use client";

import Image from "next/image";
import { useAppSelector } from "@/state/hooks";
import { useServerCountdown } from "@/hooks/useServerCountdown";
import CountdownRing from "@/components/CountdownRing";
import { Button } from "@/components/ui/Button";
import ShareRoom from "@/components/ShareRoom";
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
      <div className="flex items-center w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-fit dark:text-white *:bg-white dark:*:bg-dark">
        <div className="h-full w-full md:w-1/3 lg:max-w-sm mx-2 hidden pt-8 md:block rounded-xl">
          <div className="flex justify-center">
            <CountdownRing
              key={question.id}
              duration={question.timeOut}
              remaining={remaining}
            />
          </div>
          <div className="pl-4 mt-2">
            <div className="text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/40 rounded-full px-2 w-fit font-bold">
              &#9679; Live
            </div>
            <div className="text-2xl font-black">{quizTitle}</div>
          </div>
          <div className="mt-24 mb-2 pl-4">
            <div className="text-md">Room Code</div>
            <div className="text-4xl font-black">{gameCode}</div>
            <div className="mt-4">
              <ShareRoom gameCode={gameCode} variant="compact" />
            </div>
          </div>
        </div>
        <div className="h-full w-full md:mx-2 md:rounded-xl flex flex-col justify-center">
          <div className="my-6 md:hidden flex flex-col items-center">
            <div className="text-md">Room Code</div>
            <div className="text-2xl font-black">{gameCode}</div>
            <div className="mt-3">
              <ShareRoom gameCode={gameCode} variant="compact" />
            </div>
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
          <div className="mt-2 mb-6 px-8 flex justify-end">
            <Button
              className="w-24 h-10 rounded!"
              size="sm"
              onClick={() => socket.emit("host-next")}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
