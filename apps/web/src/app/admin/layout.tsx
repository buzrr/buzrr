export const dynamic = "force-dynamic";

import SessionProvider from "@/components/SessionProvider";
import { redirect } from "next/navigation";
import AdminLogoBar from "@/components/Admin/AdminLogoBar";
import SupportNudge from "@/components/SupportNudge";
import ToastViewport from "@/components/ToastViewport";
import type { Metadata } from "next";
import { NOINDEX_METADATA } from "@/lib/seo/metadata";

import { auth } from "@/lib/auth";
import { getUserRole } from "@/lib/get-current-role";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Admin Panel",
  ...NOINDEX_METADATA,
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
      {/* pb-12: room for the fixed site footer (48px) so it never covers the
          bottom of a page. Full-height screens subtract the same 3rem. */}
      <div className="flex flex-col w-screen pb-12">
        <AdminLogoBar />
        {children}
        <ToastViewport />
        <SupportNudge />
      </div>
    </SessionProvider>
  );
}
