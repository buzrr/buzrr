"use server";

import { auth } from "@/utils/auth";
import { prisma } from "@buzrr/prisma";
import { redirect } from "next/navigation";

async function dltQuestion(quesId: string) {
  try {
    const session = await auth();
    if (!session || !session.user) redirect("/api/auth/signin");

    await prisma.question.delete({
      where: {
        id: quesId,
      },
    });
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Something went wrong",
    };
  }
}

export default dltQuestion;
