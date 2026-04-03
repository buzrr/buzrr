import AdminPlayClient from "@/components/Admin/AdminPlayClient";
import { auth } from "@/utils/auth";
import { redirect } from "next/navigation";

export default async function Play({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect("/api/auth/signin");

  return <AdminPlayClient roomId={roomId} userId={session.user.id} />;
}
