"use client";

import Link from "next/link";
import ClientImage from "@/components/ClientImage";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function NotFound() {
  return (
    <div className="h-screen w-screen flex flex-col">
    <div className="p-2 px-4 md:px-8 bg-light-bg dark:bg-dark-bg">
        <Link href="/">
          <ClientImage
            props={{
              src: "/images/logo.svg",
              darksrc: "/images/logo-dark.svg",
              alt: "Buzzr Logo",
              width: 80,
              height: 80,
            }}
          />
        </Link>
      </div>
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-4xl font-bold dark:text-white">404 - Page Not Found</h1>
        <p className="text-lg dark:text-white">The page you are looking for does not exist.</p>
        <Link href="/" className="text-blue-500">Go back to the home page</Link>
      </div>
    </div>
  );
}