"use client";

import clsx from "clsx";
import Image from "next/image";
import { mutedText } from "@/components/Game/GameUI";
import { MeCard } from "./JoinShell";

function GhostRow({ rank }: { rank: number }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border px-4 py-3 bg-white dark:bg-dark border-lprimary/15 dark:border-white/5 opacity-55">
      <span className={clsx("w-[30px] text-sm font-extrabold", mutedText)}>
        {rank}
      </span>
      <span className="size-[34px] shrink-0 rounded-full bg-lprimary/10 dark:bg-white/10" />
      <i className="block flex-1 h-2.5 rounded-md bg-lprimary/10 dark:bg-white/10" />
      <i className="block w-[50px] h-2.5 rounded-md bg-lprimary/10 dark:bg-white/10" />
    </div>
  );
}

/** Live preview of the profile being created, as it appears on a leaderboard. */
export default function ProfilePreview({
  name,
  image,
}: {
  name: string;
  image: string;
}) {
  return (
    <>
      <MeCard image={image} name={name} />
      <div className="w-full max-w-[440px] flex flex-col gap-2.5">
        <GhostRow rank={1} />
        <div className="flex items-center gap-3.5 rounded-2xl border-2 px-4 py-3 bg-white dark:bg-dark border-dprimary shadow-[0_14px_30px_-16px_#7c4ddb]">
          <span className={clsx("w-[30px] text-sm font-extrabold", mutedText)}>
            2nd
          </span>
          <Image
            src={image}
            width={36}
            height={36}
            alt=""
            className="size-9 rounded-full object-cover"
          />
          <span className="flex-1 min-w-0 truncate text-base font-bold">
            {name || "Your Name"}
          </span>
          <span className={clsx("text-sm font-bold", mutedText)}>1250 pt.</span>
        </div>
        <GhostRow rank={3} />
      </div>
      <span className={clsx("text-[13px]", mutedText)}>
        This is how other players will see you on the leaderboard.
      </span>
    </>
  );
}
