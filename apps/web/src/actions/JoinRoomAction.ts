"use server";
import { prisma } from "@buzrr/prisma";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/server/upstash";
import { headers } from "next/headers";

const rateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, "120s"),
});

export default async function joinRoom(formData: FormData) {
  try {
    if (process.env.RATELIMIT === "ON") {
      const ip = headers().get("x-forwarded-for");

      const { remaining, limit, success } = await rateLimit.limit(ip as string);

      if (!success) {
        throw new Error("Rate limit reached wait for some time and try again.");
      }
    }

    const gameCode = formData.get("gameCode") as string;
    const playerId = formData.get("playerId") as string;

    const game = await prisma.gameSession.findUnique({
      where: { gameCode },
    });

    if (!game) {
      throw new Error("Game not found");
    }

    const playerAttach = await prisma.player.update({
      where: { id: playerId },
      data: {
        gameId: game.id,
      },
    });

    if (!playerAttach) {
      throw new Error("Player not found");
    }
    return { roomId: game.id, playerId: playerId };
  } catch (err: any) {
    return { error: err.message };
  }
}
