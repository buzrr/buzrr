"use server";

import { auth } from "@/utils/auth";
import { prisma } from "@/utils/prisma";
import { redirect } from "next/navigation";

export default async function ShowLeaderboard(gameCode: string) {
  const session = await auth();
  if (!session || !session.user) redirect("/api/auth/signin");
  const room = await prisma.gameSession.findUnique({
    where: {
      gameCode: gameCode,
    },
  });
  const leaderboard = await prisma.gameLeaderboard.findMany({
    where: {
      gameSessionId: room?.id,
    },
    include: {
      Player: true,
    },
    orderBy: {
      score: "desc",
    },
  });
  return leaderboard;
}
