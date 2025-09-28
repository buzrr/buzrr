"use server";

import { auth } from "@/utils/auth";
import { prisma } from "@/utils/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function reOrderQuestion({
  dragQuesId,
  dropQuesId,
}: {
  dragQuesId: string;
  dropQuesId: string;
}) {
  try {
    const session = await auth();
    if (!session || !session.user) redirect("/api/auth/signin");

    const dragQues = await prisma.question.findUnique({
      where: {
        id: dragQuesId,
      },
    });

    const dropQues = await prisma.question.findUnique({
      where: {
        id: dropQuesId,
      },
    });

    const dragQuesOrder = dragQues?.order;
    const dropQuesOrder = dropQues?.order;

    await prisma.question.update({
      where: {
        id: dragQuesId,
      },
      data: {
        order: dropQuesOrder,
      },
    });

    await prisma.question.update({
      where: {
        id: dropQuesId,
      },
      data: {
        order: dragQuesOrder,
      },
    });

    return {
      status: 200,
      message: "Success",
    };
  } catch (err: any) {
    return {
      status: 500,
      error: err.message,
    };
  }
}

export default reOrderQuestion;
