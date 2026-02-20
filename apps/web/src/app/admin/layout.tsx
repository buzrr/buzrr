import SessionProvider from "@/components/SessionProvider";
import { redirect } from "next/navigation";
import ReduxProvider from "@/state/ReduxProvider";
import ClientImage from "@/components/ClientImage";
import { ToastContainer } from "react-toastify";
import type { Metadata } from "next";

import { auth } from "@/utils/auth";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Buzzr Admin",
  description: "Buzzr Admin Panel",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session || !session.user) {
    redirect("api/auth/signin");
  }
  return (
    <>
      <SessionProvider>
        <ReduxProvider>
          <div className="flex flex-col w-screen">
            <div className="p-2 px-4 md:px-8 bg-light-bg dark:bg-dark-bg hidden md:block">
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
            {children}
            <ToastContainer />
          </div>
        </ReduxProvider>
      </SessionProvider>
    </>
  );
}
