import { prisma } from "@buzrr/prisma";
import { auth } from "@/utils/auth";
import { redirect } from "next/navigation";
import ClientBuzrrs from "./ClientBuzrrs";

const Buzrrs = async () => {
  const session = await auth();

  if (!session || !session.user) redirect("/api/auth/signin");

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email as string,
    },
  });

  const quizzes = await prisma.quiz.findMany({
    where: {
      userId: user?.id as string,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return <ClientBuzrrs quizzes={quizzes} />;
};

export default Buzrrs;
