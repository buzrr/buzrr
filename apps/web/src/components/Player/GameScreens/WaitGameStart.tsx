import Game from "@/components/Game";
import BackNavButton from "@/components/BackNavButton";
import { DEFAULT_AVATAR } from "@/constants";
import { GameSession } from "@buzrr/prisma";
import Image from "next/image";

interface PlayerWithProfile {
  id?: string;
  profilePic?: string;
  name?: string;
  [key: string]: unknown;
}

interface GameWithQuiz extends GameSession {
  quiz: { title?: string };
}

const WaitGameStart = (params: { player: PlayerWithProfile; game: GameWithQuiz }) => {
  const game = params.game;

  return (
    <>
      <div className="px-4 py-2">
        <div className="w-full h-[81vh] flex gap-4 *:bg-white dark:*:bg-dark *:rounded-xl">
          <div className="w-full md:w-full p-4 hidden md:flex md:flex-col">
            <BackNavButton />
            <h1 className="text-5xl py-2 font-extrabold dark:text-white">
              {game.quiz.title}
            </h1>
            <h2 className="text-sm mt-8 p-2 dark:text-white">
              You&apos;ve joined as
            </h2>
            <div className="flex justify-between items-center w-fit gap-2 rounded-full p-3 bg-off-white dark:bg-off-dark font-bold text-dark dark:text-white">
              <Image
                src={params.player.profilePic || DEFAULT_AVATAR}
                width={50}
                height={50}
                alt="Profile"
                className="rounded-full h-8 w-8"
              />
              {params.player.name}
            </div>
            <div className="flex flex-col mt-10">
              <p className="text-sm dark:text-off-white py-1">Room Code</p>
              <h2 className="text-4xl font-extrabold dark:text-white py-1">
                {game.gameCode}
              </h2>
            </div>
            <div className="mt-auto">
              <p className="text-sm dark:text-off-white py-2">Quiz By</p>
              <Image
                src={game.creator.image || DEFAULT_AVATAR}
                width={50}
                height={50}
                alt="Profile"
                className="rounded-full h-8 w-8 inline"
              />
              <h2 className="dark:text-white inline p-2">
                {game.creator.name}
              </h2>
            </div>
          </div>
          <div className="md:w-[45vw] w-[99vw] flex flex-col p-2 md:p-4">
            <h1 className="text-2xl py-2 font-extrabold dark:text-white md:hidden">
              {game.quiz.title}
            </h1>
            <h2 className="text-xs p-2 dark:text-white md:hidden">
              You&apos;ve joined as
            </h2>
            <div className="text-xs flex justify-between items-center w-fit gap-2 rounded-full p-2 mb-2 bg-off-white dark:bg-off-dark font-bold text-dark dark:text-white md:hidden">
              <Image
                src={params.player.profilePic || DEFAULT_AVATAR}
                width={50}
                height={50}
                alt="Profile"
                className="rounded-full h-5 w-5"
              />
              {params.player.name}
            </div>
            <Game />
            <div className="flex flex-col mt-2 md:hidden">
              <p className="text-xs dark:text-off-white">Room Code</p>
              <h2 className="text-2xl font-extrabold dark:text-white">
                {game.gameCode}
              </h2>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default WaitGameStart;
