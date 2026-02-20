import { auth } from "@/utils/auth";
import { prisma } from "@buzrr/prisma";
import { redirect } from "next/navigation";
import { customAlphabet } from "nanoid";

const createRoom = async (formData: FormData) => {
  "use server";

  const session = await auth();
  if (!session || !session.user) redirect("/api/auth/signin");

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email as string,
    },
  });
  if (!user) redirect("/api/auth/signin");

  const quizId = formData.get("quizId") as string;
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, userId: user.id },
  });
  if (!quiz) {
    redirect("/admin?error=unauthorized");
  }

  const gameCode = customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 6)();

  const room = await prisma.gameSession.create({
    data: {
      gameCode,
      quizId,
      creatorId: user.id,
    },
  });

  redirect(`/admin/play/${room?.id}`);
};

export default createRoom;
