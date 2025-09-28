"use server";

import { auth } from "@/utils/auth";
import { prisma } from "@/utils/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

const addBuzzr = async (formData: FormData) => {
  try {
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const session = await auth();
    if (!session || !session.user) redirect("/api/auth/signin");

    const user = await prisma.user.findUnique({
      where: {
        email: session.user.email as string,
      },
    });

    const quiz = await prisma.quiz.create({
      data: {
        title,
        description,
        userId: user?.id as string,
      },
    });

    revalidatePath("/admin", "page");
    return { quizId: quiz.id };
  } catch (err: any) {
    return { error: err.message };
  }
};

export default addBuzzr;
