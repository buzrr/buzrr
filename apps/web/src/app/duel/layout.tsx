import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DuelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/auth/login?callbackURL=/duel");

  return (
    <div className="min-h-dvh bg-light-bg dark:bg-dark-bg">{children}</div>
  );
}
