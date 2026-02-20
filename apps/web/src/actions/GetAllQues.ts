"use server";

import { auth } from "@/utils/auth";
import { prisma } from "@buzrr/prisma";
import { redirect } from "next/navigation";

async function getAllQuestion(quizId: string) {
  try {
    const session = await auth();

    if (!session || !session.user) redirect("/api/auth/signin");
    const questions = await prisma.question.findMany({
      where: {
        quizId: quizId as string,
      },
      include: {
        options: true,
      },
    });

    return { status: 200, questions };
  } catch (err: any) {
    return {
      status: 500,
      error: err.message,
    };
  }
}

export default getAllQuestion;
