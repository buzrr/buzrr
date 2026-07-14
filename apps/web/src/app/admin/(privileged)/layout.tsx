import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getUserRole } from "@/lib/get-current-role";

/** Gate for anything only admins/superadmins may reach (e.g. the moderation queue). */
export default async function PrivilegedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/auth/login");
  }
  const role = await getUserRole(session.user.id);
  if (role !== "admin" && role !== "superadmin") {
    redirect("/admin");
  }
  return <>{children}</>;
}
