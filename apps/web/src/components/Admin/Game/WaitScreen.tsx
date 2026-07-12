"use client";

import { useAppSelector } from "@/state/hooks";
import { useServerCountdown } from "@/hooks/useServerCountdown";

/**
 * Pre-question countdown. The deadline for the first question is set by the
 * server when the game starts; this screen only renders the remaining time.
 */
export default function WaitScreen() {
  const deadline = useAppSelector((state) => state.game.deadline);
  const clockOffset = useAppSelector((state) => state.game.clockOffset);
  const remaining = useServerCountdown(deadline, clockOffset);
  const seconds = Math.ceil(remaining);

  return (
    <>
      <div className="w-screen h-dvh bg-lprimary dark:bg-dprimary absolute top-0 flex flex-col-reverse pb-8 justify-center items-center">
        <div className="flex flex-col justify-center items-center text-dark dark:text-white w-full container h-32 m-auto">
          <span
            className="overflow-hidden animate-ping text-7xl font-semibold text-white dark:text-dark-bg overscroll-none"
            id="countdown"
          >
            {deadline > 0 && seconds === 0 && "LESGOOO"}
          </span>
          <span
            className="overflow-hidden animate-ping text-7xl font-semibold overscroll-none text-white dark:text-dark-bg"
            id="countdown"
          >
            {seconds > 0 && seconds}
          </span>
        </div>
        <span className="bg-white dark:bg-dark-bg w-10 h-10 rounded-full absolute top-[13vh] left-[15vw] md:left-[30vw] animate-pulse" />
        <span className="bg-white dark:bg-dark-bg w-8 h-8 rounded-full absolute bottom-[12vh] left-[20vw] md:left-[38vw] animate-pulse" />
        <span className="bg-white dark:bg-dark-bg w-4 h-4 rounded-full absolute bottom-[18vh] right-[20vw] md:right-[30vw] animate-pulse" />
        <span className="bg-white dark:bg-dark-bg w-6 h-6 rounded-full absolute top-[45vh] right-[32vw] animate-pulse hidden md:block" />
        <span className="bg-white dark:bg-dark-bg w-8 h-8 rounded-full absolute top-[8vh] right-[25vw] animate-pulse" />
      </div>
    </>
  );
}
