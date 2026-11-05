"use client";

import clsx from "clsx";
import Image from "next/image";
import {
  OptionKey,
  TimerBar,
  mutedText,
  subtleCardClass,
} from "@/components/Game/GameUI";

const OPTIONS = ["Venus", "Mars", "Jupiter", "Saturn"];
const YOUR_PICK = 1;

function PlayerChip({
  name,
  avatar,
  score,
}: {
  name: string;
  avatar: string;
  score: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-white dark:bg-dark py-1 pl-1 pr-4 shadow">
      <span className="relative shrink-0">
        <Image
          src={avatar}
          width={36}
          height={36}
          alt=""
          className="h-9 w-9 rounded-full"
        />
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white bg-green-500" />
      </span>
      <div className="text-left">
        <p className="text-xs font-bold leading-tight text-dark dark:text-white">
          {name}
        </p>
        <p className="text-sm font-black leading-tight text-lprimary dark:text-dprimary">
          {score}
        </p>
      </div>
    </div>
  );
}

/**
 * A still of the 1v1 question screen with sample data, after the player has
 * answered. It shows only what a player sees: their own pick and both scores,
 * never the opponent's answer.
 */
const HeroVisual = () => {
  return (
    <div
      role="img"
      aria-label="A 1v1 duel in progress: you and your opponent's scores, a countdown, and the answer you picked for question 3 of 7."
      className="animate-fade-up [animation-delay:200ms] rounded-3xl border border-card-light dark:border-card-dark bg-white dark:bg-dark p-4 sm:p-6 shadow-2xl shadow-lprimary/10 dark:shadow-black/40"
    >
      <div className="mx-auto max-w-xl text-left text-dark dark:text-white">
        <div className="flex items-center justify-center gap-2 sm:gap-4">
          <PlayerChip
            name="You"
            avatar="/images/player_profile/profile1.png"
            score={1650}
          />
          <span className="font-black text-off-dark dark:text-off-white">
            VS
          </span>
          <PlayerChip
            name="Riya"
            avatar="/images/player_profile/profile2.png"
            score={1430}
          />
        </div>

        <div
          className={clsx(
            "mt-5 mb-2 flex items-center justify-between text-[13px]",
            mutedText,
          )}
        >
          <span className="font-semibold">1v1 Duel · Science</span>
          <span>Question 3 of 7</span>
        </div>
        <TimerBar value={12} max={20} />

        <p className="mt-4 text-xl sm:text-2xl font-bold tracking-[-0.01em]">
          Which planet is known as the Red Planet?
        </p>

        <div className="mt-4 flex flex-col gap-2.5">
          {OPTIONS.map((option, index) => (
            <div
              key={option}
              className={clsx(
                "flex items-center gap-3.5 rounded-2xl border-[1.5px] px-3.5 py-2.5 text-base font-semibold",
                index === YOUR_PICK
                  ? "border-lprimary dark:border-dprimary bg-lprimary/10 dark:bg-dprimary/15"
                  : clsx(subtleCardClass, "opacity-50"),
              )}
            >
              <OptionKey
                index={index}
                className="size-9 text-[15px] rounded-[10px]"
              />
              {option}
            </div>
          ))}
        </div>

        <p className={clsx("mt-4 text-center text-sm", mutedText)}>
          Answer received — waiting for the results
        </p>
      </div>
    </div>
  );
};

export default HeroVisual;
