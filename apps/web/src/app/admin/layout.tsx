export const dynamic = "force-dynamic";

import SessionProvider from "@/components/SessionProvider";
import { redirect } from "next/navigation";
import ClientImage from "@/components/ClientImage";
import ToastViewport from "@/components/ToastViewport";
import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { getUserRole } from "@/lib/get-current-role";
import { headers } from "next/headers";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Admin Panel",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/auth/login");
  }
  const role = await getUserRole(session.user.id);
  return (
    <SessionProvider role={role}>
      <div className="flex flex-col w-screen">
        <div className="p-2 px-4 md:px-8 bg-light-bg dark:bg-dark-bg hidden md:block">
          <Link href="/">
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
        {children}
        <ToastViewport />
      </div>
    </SessionProvider>
  );
}
