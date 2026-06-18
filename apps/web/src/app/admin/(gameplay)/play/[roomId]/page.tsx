import AdminPlayClient from "@/components/Admin/AdminPlayClient";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Play({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) redirect("/auth/login");

  return <AdminPlayClient roomId={roomId} userId={session.user.id} />;
}
