"use client";

import Image from "next/image";
import Link from "next/link";
import { DEFAULT_AVATAR } from "@/constants";
import { authClient } from "@/lib/auth-client";

export default function AdminHomeHeader() {
  const { data: session } = authClient.useSession();
  const firstName = session?.user?.name?.split(" ")[0];

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/admin/profile"
        aria-label="Open your profile"
        className="shrink-0"
      >
        <Image
          src={session?.user?.image || DEFAULT_AVATAR}
          alt="Profile Picture"
          width={52}
          height={52}
          className="rounded-full hover:opacity-90 transition-opacity"
        />
      </Link>
      <span>
        <p className="text-xs md:text-[17px] font-medium text-off-dark dark:text-[#9a9aa2]">
          Hey {firstName ?? "There"} 👋!
        </p>
        <h1 className="text-md md:text-4xl font-bold tracking-[-0.02em] leading-tight md:mt-1 text-dark dark:text-white">
          Welcome Back To Your Quiz Hub!
        </h1>
      </span>
    </div>
  );
}
