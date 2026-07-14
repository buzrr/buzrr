import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getUserRole } from "@/lib/get-current-role";

/** Stricter nested gate -- only superadmins may manage other admins' roles. */
export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/auth/login");
  }
  const role = await getUserRole(session.user.id);
  if (role !== "superadmin") {
    redirect("/admin/moderation");
  }
  return <>{children}</>;
}
