import AdminGameLobbyClient from "@/components/Admin/AdminGameLobbyClient";
import { auth } from "@/utils/auth";
import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect("/api/auth/signin");

  return <AdminGameLobbyClient roomId={roomId} userId={session.user.id} />;
}
