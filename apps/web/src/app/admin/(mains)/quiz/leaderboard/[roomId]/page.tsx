import QuizLeaderboardClient from "@/components/Admin/Quiz/QuizLeaderboardClient";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function QuizLeaderboard({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect("/auth/login");

  return <QuizLeaderboardClient roomId={roomId} />;
}
