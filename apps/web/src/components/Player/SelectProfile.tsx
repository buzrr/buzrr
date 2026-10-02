"use client";

import clsx from "clsx";
import Image from "next/image";
import { LuCheck, LuShuffle } from "react-icons/lu";
import { joinLabelClass } from "@/components/Player/Setup/JoinShell";

export const PROFILES = [
  "/images/player_profile/profile1.png",
  "/images/player_profile/profile2.png",
  "/images/player_profile/profile3.png",
  "/images/player_profile/profile4.png",
  "/images/player_profile/profile5.jpg",
  "/images/player_profile/profile6.png",
  "/images/player_profile/profile7.jpg",
  "/images/player_profile/profile9.jpg",
  "/images/player_profile/profile10.jpg",
  "/images/player_profile/profile11.jpg",
  "/images/player_profile/profile12.png",
];

export default function SelectProfile(props: {
  data: {
    name: string;
    image: string;
  };
  setData: (data: { name: string; image: string }) => void;
}) {
  const selected = Math.max(0, PROFILES.indexOf(props.data.image));

  function pick(index: number) {
    props.setData({ ...props.data, image: PROFILES[index] });
  }

  function shuffle() {
    const offset = 1 + Math.floor(Math.random() * (PROFILES.length - 1));
    pick((selected + offset) % PROFILES.length);
  }

  return (
    <div>
      <div className={joinLabelClass}>
        Pick an avatar
        <button
          type="button"
          onClick={shuffle}
          className="flex items-center gap-1.5 rounded-[9px] px-[11px] py-1.5 text-[12.5px] font-semibold bg-lprimary/8 dark:bg-white/5 hover:bg-lprimary/15 dark:hover:bg-white/10 transition-colors cursor-pointer"
        >
          <LuShuffle size={14} />
          Shuffle
        </button>
      </div>
      <div
        role="radiogroup"
        aria-label="Avatar"
        className="mt-2.5 grid grid-cols-4 sm:grid-cols-6 gap-2.5 md:gap-3"
      >
        {PROFILES.map((src, index) => {
          const on = index === selected;
          return (
            <button
              key={src}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`Avatar ${index + 1}`}
              onClick={() => pick(index)}
              className={clsx(
                "relative aspect-square rounded-full border-[3px] transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-0.5 cursor-pointer",
                on
                  ? "border-dprimary shadow-[0_0_0_4px_rgba(139,92,246,0.18)]"
                  : "border-transparent",
              )}
            >
              <Image
                src={src}
                width={96}
                height={96}
                alt=""
                className="size-full rounded-full object-cover"
              />
              {on && (
                <span className="absolute -right-0.5 -bottom-0.5 size-[26px] rounded-full bg-lprimary text-white flex items-center justify-center border-[3px] border-white dark:border-dark">
                  <LuCheck size={13} strokeWidth={3.2} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
