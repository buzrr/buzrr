import QuizLeaderboardClient from "@/components/Admin/Quiz/QuizLeaderboardClient";
import { auth } from "@/utils/auth";
import { redirect } from "next/navigation";

export default async function QuizLeaderboard({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const session = await auth();

  if (!session?.user) redirect("/api/auth/signin");

  return <QuizLeaderboardClient roomId={roomId} />;
}
