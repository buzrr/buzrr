"use client";

import { useState, type ReactNode } from "react";
import { LuPencil } from "react-icons/lu";
import Game, { type BubbleStats } from "@/components/Game";
import BackNavButton from "@/components/BackNavButton";
import { DEFAULT_AVATAR } from "@/constants";
import type { GameSession } from "@/types/db";
import Image from "next/image";

interface PlayerWithProfile {
  id?: string;
  profilePic?: string;
  name?: string;
  [key: string]: unknown;
}

interface GameWithQuiz extends GameSession {
  quiz: { title?: string };
  creator?: { name?: string | null; image?: string | null };
}

const WaitGameStart = (params: {
  player: PlayerWithProfile;
  game: GameWithQuiz;
  /** Back/leave action — opens the "you'll leave the game" confirmation. */
  onLeave?: () => void;
  /** Bubble game totals, about once a second (sent on to the host). */
  onBubbleStats?: (stats: BubbleStats) => void;
  /** Reaction buttons, shown under the bubble field (never over it). */
  reactionBar?: ReactNode;
  /** This room's avatar skin: the player may switch while waiting. */
  avatars?: string[];
  onPickAvatar?: (profilePic: string) => void;
}) => {
  const game = params.game;
  const [pic, setPic] = useState(params.player.profilePic || DEFAULT_AVATAR);
  const [picking, setPicking] = useState(false);
  const canPick = (params.avatars?.length ?? 0) > 1 && params.onPickAvatar;
  const chip = (size: "lg" | "sm") => (
    <button
      type="button"
      disabled={!canPick}
      onClick={() => setPicking((v) => !v)}
      title={canPick ? "Change your avatar" : undefined}
      className={
        size === "lg"
          ? "flex justify-between items-center w-fit gap-2 rounded-full p-3 bg-off-white dark:bg-off-dark font-bold text-dark dark:text-white enabled:cursor-pointer"
          : "text-xs flex justify-between items-center w-fit gap-2 rounded-full p-2 mb-2 bg-off-white dark:bg-off-dark font-bold text-dark dark:text-white md:hidden enabled:cursor-pointer"
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- skin files and uploads */}
      <img
        src={pic}
        alt="Profile"
        className={
          size === "lg"
            ? "rounded-full h-8 w-8 object-cover"
            : "rounded-full h-5 w-5 object-cover"
        }
      />
      {params.player.name}
      {canPick && (
        <LuPencil size={size === "lg" ? 14 : 12} className="opacity-60" />
      )}
    </button>
  );
  const picker =
    picking && canPick ? (
      <div
        role="radiogroup"
        aria-label="Your avatar"
        className="grid grid-cols-6 gap-2 p-2 mb-2 rounded-2xl bg-off-white dark:bg-off-dark"
      >
        {params.avatars!.map((src) => (
          <button
            key={src}
            type="button"
            role="radio"
            aria-checked={src === pic}
            onClick={() => {
              setPic(src);
              setPicking(false);
              params.onPickAvatar!(src);
            }}
            className={
              "aspect-square rounded-full border-[3px] cursor-pointer " +
              (src === pic ? "border-dprimary" : "border-transparent")
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- skin files and uploads */}
            <img
              src={src}
              alt=""
              className="size-full rounded-full object-cover"
            />
          </button>
        ))}
      </div>
    ) : null;

  return (
    <>
      <div className="px-4 py-2">
        <div className="w-full h-[81dvh] flex gap-4 md:justify-center *:bg-white dark:*:bg-dark *:rounded-xl">
          <div className="w-full md:w-[26vw] md:max-w-sm p-4 hidden md:flex md:flex-col">
            <div className="self-start">
              <BackNavButton onBack={params.onLeave} />
            </div>
            <h1 className="text-5xl py-2 font-extrabold dark:text-white">
              {game.quiz.title}
            </h1>
            <h2 className="text-sm mt-8 p-2 dark:text-white">
              You&apos;ve joined as
            </h2>
            {chip("lg")}
            <div className="mt-2 hidden md:block">{picker}</div>
            <div className="flex flex-col mt-10">
              <p className="text-sm dark:text-off-white py-1">Room Code</p>
              <h2 className="text-4xl font-extrabold dark:text-white py-1">
                {game.gameCode}
              </h2>
            </div>
            <div className="mt-auto">
              <p className="text-sm dark:text-off-white py-2">Quiz By</p>
              <Image
                src={game.creator?.image ?? DEFAULT_AVATAR}
                width={50}
                height={50}
                alt="Profile"
                className="rounded-full h-8 w-8 inline"
              />
              <h2 className="dark:text-white inline p-2">
                {game.creator?.name}
              </h2>
            </div>
          </div>
          <div className="md:w-[45vw] w-full flex flex-col p-2 md:p-4">
            <h1 className="text-2xl py-2 font-extrabold dark:text-white md:hidden">
              {game.quiz.title}
            </h1>
            <h2 className="text-xs p-2 dark:text-white md:hidden">
              You&apos;ve joined as
            </h2>
            {chip("sm")}
            <div className="md:hidden">{picker}</div>
            <Game onStats={params.onBubbleStats} />
            {params.reactionBar}
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
