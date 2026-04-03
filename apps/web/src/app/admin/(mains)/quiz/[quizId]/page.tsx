import QuizDetailClient from "@/components/Admin/Quiz/QuizDetailClient";
import { auth } from "@/utils/auth";
import { redirect } from "next/navigation";

export default async function Quiz({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect("/api/auth/signin");

  return <QuizDetailClient quizId={quizId} />;
}
