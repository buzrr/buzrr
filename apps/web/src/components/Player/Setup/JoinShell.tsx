"use client";

import clsx from "clsx";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { LuArrowLeft } from "react-icons/lu";
import ClientImage from "@/components/ClientImage";
import { DEFAULT_AVATAR } from "@/constants";
import { mutedText, panelClass } from "@/components/Game/GameUI";

export {
  inputClass as joinInputClass,
  fieldLabelClass as joinLabelClass,
  counterClass as joinCounterClass,
} from "@/components/Game/GameUI";

export function BackSquare({ href }: { href: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Go back"
      onClick={() => router.push(href)}
      className="size-11 rounded-xl border border-lprimary/15 dark:border-white/10 flex items-center justify-center hover:bg-lprimary/8 dark:hover:bg-white/5 transition-colors cursor-pointer"
    >
      <LuArrowLeft size={20} />
    </button>
  );
}

export function Steps({ step, total = 2 }: { step: number; total?: number }) {
  return (
    <span
      className={clsx(
        "flex items-center gap-2 text-[13px] font-semibold",
        mutedText,
      )}
    >
      {Array.from({ length: total }, (_, i) => (
        <i
          key={i}
          className={clsx(
            "h-1.5 w-[26px] rounded",
            i < step
              ? "bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb]"
              : "bg-lprimary/10 dark:bg-white/10",
          )}
        />
      ))}
      Step {step} of {total}
    </span>
  );
}

export function MeCard({
  image,
  name,
  action,
  size = "lg",
}: {
  image: string | null;
  /** null hides the name row (e.g. while it is being edited). */
  name: string | null;
  action?: ReactNode;
  size?: "lg" | "md";
}) {
  return (
    <div className="flex flex-col items-center gap-3.5">
      <span className="rounded-full p-1.5 bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] shadow-[0_24px_50px_-20px_#7c4ddb]">
        <span className="block rounded-full border-[5px] border-light-bg dark:border-card-dark">
          <Image
            src={image || DEFAULT_AVATAR}
            width={180}
            height={180}
            alt=""
            className={clsx(
              "rounded-full object-cover",
              size === "lg" ? "size-[150px] lg:size-[180px]" : "size-28",
            )}
          />
        </span>
      </span>
      {name !== null && (
        <span
          className={clsx(
            "flex items-center gap-3 text-[26px] font-bold tracking-[-0.01em] max-w-full",
            !name && "text-[#8a8896] dark:text-[#71717a]",
          )}
        >
          <span className="truncate">{name || "Your Name"}</span>
          {action}
        </span>
      )}
    </div>
  );
}

/**
 * Two-panel frame for the player join flow: the form on the left and a live
 * preview on the right (hidden on small screens).
 */
export default function JoinShell({
  form,
  preview,
}: {
  form: ReactNode;
  preview: ReactNode;
}) {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col pb-16 md:pb-6 md:min-h-[calc(100dvh-3rem)] text-dark dark:text-white">
      <div className="py-4">
        <ClientImage
          props={{
            src: "/images/logo.svg",
            darksrc: "/images/logo-dark.svg",
            alt: "Buzrr Logo",
            width: 80,
            height: 80,
          }}
        />
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5">
        <section
          className={clsx(
            panelClass,
            "flex flex-col justify-center gap-5 md:gap-6 px-5 py-[22px] md:px-11 md:py-9",
          )}
        >
          {form}
        </section>
        <section
          className={clsx(
            panelClass,
            "hidden md:flex flex-col items-center justify-center gap-[26px] p-9 !bg-light-bg dark:!bg-card-dark",
          )}
        >
          {preview}
        </section>
      </div>
    </div>
  );
}
