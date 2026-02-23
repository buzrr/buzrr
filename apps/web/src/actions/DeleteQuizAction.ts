"use server";

import { auth } from "@/utils/auth";
import { prisma } from "@buzrr/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function dltQuiz(quizId: string) {
  try {
    const session = await auth();
    if (!session || !session.user) redirect("/api/auth/signin");

    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, userId: session.user.id },
    });
    if (!quiz) {
      return { error: "Unauthorized or quiz not found" };
    }

    await prisma.quiz.delete({
      where: { id: quizId },
    });

    revalidatePath("/admin", "page");
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Something went wrong",
    };
  }
}

export default dltQuiz;
