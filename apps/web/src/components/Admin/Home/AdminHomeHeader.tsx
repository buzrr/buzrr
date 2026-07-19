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
        <p className="dark:text-white text-xs md:text-base">
          Hey {firstName ?? "There"}👋!
        </p>
        <h1 className="text-md md:text-3xl font-black text-dark dark:text-white">
          Welcome to Your Quiz Hub!
        </h1>
      </span>
    </div>
  );
}
