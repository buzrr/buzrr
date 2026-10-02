"use client";

import clsx from "clsx";
import { useState, type ReactNode } from "react";
import { LuScanLine } from "react-icons/lu";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import "react-toastify/dist/ReactToastify.css";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useJoinRoomMutation } from "@/lib/modules/game-sessions/hooks";
import { clearPlayerLocalSession } from "@/lib/player-session";
import { isAxiosError } from "axios";
import { mutedText, primaryButtonClass } from "@/components/Game/GameUI";
import {
  BackSquare,
  Steps,
  joinCounterClass,
  joinLabelClass,
} from "./JoinShell";

const CODE_LENGTH = 6;

const normalizeCode = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, CODE_LENGTH);

const JoinRoomForm = ({ joiningAs }: { joiningAs?: ReactNode }) => {
  const router = useRouter();
  const mutation = useJoinRoomMutation();
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length < CODE_LENGTH) return;
    mutation.mutate(
      { gameCode: code },
      {
        onSuccess: (res) => {
          router.push(`/player/play/${res.playerId}`);
        },
        onError: (err) => {
          if (isAxiosError(err) && err.response?.status === 401) {
            clearPlayerLocalSession();
            toast.error("Your session expired. Create your player again.");
            router.replace("/player");
            return;
          }
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  };

  const cursor = Math.min(code.length, CODE_LENGTH - 1);

  return (
    <form
      className="flex flex-col gap-5 md:gap-6 animate-fade-up"
      onSubmit={onSubmit}
    >
      <div className="flex items-center justify-between">
        <BackSquare href="/" />
        <Steps step={2} />
      </div>
      {joiningAs}
      <div>
        <h1 className="text-[32px] md:text-[44px] font-extrabold tracking-[-0.03em] leading-[1.06]">
          Enter room code
        </h1>
        <p className={clsx("mt-2.5 text-base", mutedText)}>
          Enter the 6-character code provided by the admin.
        </p>
      </div>
      <div>
        <span className={joinLabelClass}>
          Room code
          <span className={joinCounterClass}>
            {code.length}/{CODE_LENGTH}
          </span>
        </span>
        <div className="relative mt-2">
          <input
            id="gameCode"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            aria-label="Room code"
            className="absolute inset-0 z-10 size-full opacity-0 text-base cursor-text"
          />
          <div
            className="grid grid-cols-6 gap-[7px] md:gap-2.5"
            aria-hidden="true"
          >
            {Array.from({ length: CODE_LENGTH }, (_, i) => {
              const char = code[i];
              const isCursor =
                focused && i === cursor && code.length < CODE_LENGTH;
              return (
                <span
                  key={i}
                  className={clsx(
                    "aspect-[1/1.12] rounded-xl md:rounded-[14px] border-[1.5px] flex items-center justify-center text-2xl md:text-[30px] font-extrabold bg-light-bg dark:bg-card-dark transition-[border-color,box-shadow]",
                    char || isCursor
                      ? "border-dprimary"
                      : "border-lprimary/15 dark:border-white/10",
                    isCursor && "shadow-[0_0_0_4px_rgba(139,92,246,0.15)]",
                  )}
                >
                  {char ??
                    (isCursor && (
                      <span className="h-[30px] w-0.5 bg-dprimary animate-pulse" />
                    ))}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <span
        className={clsx("flex items-center gap-2 text-[13.5px]", mutedText)}
      >
        <LuScanLine size={16} className="shrink-0" />
        Got a QR code? Scan it with your camera to skip this step.
      </span>
      <button
        type="submit"
        disabled={code.length < CODE_LENGTH || mutation.isPending}
        className={clsx(primaryButtonClass, "w-full py-4 text-[17px]")}
      >
        {mutation.isPending ? "Joining..." : "Join"}
      </button>
    </form>
  );
};

export default JoinRoomForm;
