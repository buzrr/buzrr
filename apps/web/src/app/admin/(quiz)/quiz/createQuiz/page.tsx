"use client";

import clsx from "clsx";
import Image from "next/image";
import { useState } from "react";
import CreateBuzrrForm from "@/components/Admin/Home/CreateBuzrrForm";
import { labelClass, mutedText, panelClass } from "@/components/Game/GameUI";

const SAMPLE_PLAYERS = [
  { image: "/images/player_profile/profile1.png", name: "LesgooVroomVroom" },
  { image: "/images/player_profile/profile2.png", name: "SayItLoudlyBro" },
  { image: "/images/player_profile/profile3.png", name: "AlanOP" },
  { image: "/images/player_profile/profile4.png", name: "TuHaiKaaliya" },
  { image: "/images/player_profile/profile5.jpg", name: "Sanika" },
  { image: "/images/player_profile/profile6.png", name: "Pikachu" },
  { image: "/images/player_profile/profile7.jpg", name: "LakshayBansal" },
  { image: "/images/player_profile/profile9.jpg", name: "Deadass" },
  { image: "/images/player_profile/profile10.jpg", name: "HarshPanchal" },
  { image: "/images/player_profile/profile11.jpg", name: "Jack" },
  { image: "/images/player_profile/profile12.png", name: "KavitaYadav" },
];

const previewCardClass =
  "rounded-[20px] border bg-white dark:bg-dark border-lprimary/15 dark:border-white/5 p-6 flex flex-col gap-[18px]";

export default function CreateQuiz() {
  const [values, setValues] = useState({ title: "", description: "" });
  const title = values.title.trim();

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 md:pb-[18px] md:h-[calc(100dvh-7rem)] flex flex-col text-dark dark:text-white">
      <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-2 gap-3.5 md:gap-5 pt-1">
        <section
          className={clsx(
            panelClass,
            "flex flex-col px-5 py-[22px] md:px-10 md:py-9 md:min-h-0 md:overflow-y-auto",
          )}
        >
          <CreateBuzrrForm onChange={setValues} />
        </section>

        <section
          className={clsx(
            panelClass,
            "!bg-light-bg dark:!bg-card-dark hidden md:flex flex-col gap-5 p-8 min-h-0 overflow-y-auto",
          )}
        >
          <span className={labelClass}>What it looks like in the lobby</span>
          <div className={previewCardClass}>
            <div className="flex items-center gap-3.5">
              <div className="size-[52px] shrink-0 rounded-[14px] bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] text-white flex items-center justify-center text-2xl font-extrabold">
                {(title[0] ?? "Q").toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3
                  className={clsx(
                    "text-2xl font-bold tracking-[-0.01em] leading-[1.2] wrap-break-word",
                    !title && "text-[#8a8896] dark:text-[#71717a]",
                  )}
                >
                  {title || "Quiz Title"}
                </h3>
                <p className={clsx("mt-1 text-sm wrap-break-word", mutedText)}>
                  {values.description.trim() ||
                    "Your description will appear here."}
                </p>
              </div>
            </div>
          </div>
          <div className={clsx(previewCardClass, "flex-1")}>
            <div className="flex items-center justify-between">
              <span className={labelClass}>Players in lobby</span>
              <span className={clsx("text-[13px]", mutedText)}>
                {SAMPLE_PLAYERS.length} joined
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_PLAYERS.map((p) => (
                <span
                  key={p.name}
                  className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[13.5px] font-medium bg-light-bg dark:bg-card-dark border-lprimary/15 dark:border-white/5"
                >
                  <Image
                    src={p.image}
                    width={28}
                    height={28}
                    alt=""
                    className="size-7 rounded-full object-cover"
                  />
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
