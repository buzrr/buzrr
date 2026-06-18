import QuizDetailClient from "@/components/Admin/Quiz/QuizDetailClient";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function Quiz({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) redirect("/auth/login");

  return <QuizDetailClient quizId={quizId} />;
}
