"use client";

import Image from "next/image";
import Link from "next/link";
import { DEFAULT_AVATAR } from "@/constants";
import { useT } from "@/lib/i18n/context";
import { authClient } from "@/lib/auth-client";

export default function AdminHomeHeader() {
  const t = useT();
  const { data: session } = authClient.useSession();
  const firstName = session?.user?.name?.split(" ")[0];

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/admin/profile"
        aria-label={t("Open your profile")}
        className="shrink-0"
      >
        <Image
          src={session?.user?.image || DEFAULT_AVATAR}
          alt={t("Profile Picture")}
          width={52}
          height={52}
          className="rounded-full hover:opacity-90 transition-opacity"
        />
      </Link>
      <span>
        <p className="text-xs md:text-[17px] font-medium text-off-dark dark:text-muted-dark">
          {firstName
            ? t("Hey {name} 👋!", { name: firstName })
            : t("Hey there 👋!")}
        </p>
        <h1 className="text-md md:text-4xl font-bold tracking-[-0.02em] leading-tight md:mt-1 text-dark dark:text-white">
          {t("Welcome Back To Your Quiz Hub!")}
        </h1>
      </span>
    </div>
  );
}
