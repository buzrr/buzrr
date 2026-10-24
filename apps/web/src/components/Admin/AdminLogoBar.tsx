"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ClientImage from "@/components/ClientImage";

/** The admin area's logo bar — not on the host's waiting room / game screens, whose header carries the logo. */
export default function AdminLogoBar() {
  const pathname = usePathname();
  if (
    pathname.startsWith("/admin/play/") ||
    pathname.startsWith("/admin/game/")
  ) {
    return null;
  }
  return (
    <div className="p-2 bg-light-bg dark:bg-dark-bg hidden md:block">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/" className="inline-block">
          <ClientImage
            props={{
              src: "/images/logo.svg",
              darksrc: "/images/logo-dark.svg",
              alt: "Buzrr Logo",
              width: 80,
              height: 80,
            }}
          />
        </Link>
      </div>
    </div>
  );
}
