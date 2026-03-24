"use server";
import { prisma } from "@buzrr/prisma";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/server/upstash";
import { headers } from "next/headers";

const rateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, "120s"),
});

const updatePlayerName = async (formData: FormData) => {
  try {
    if (process.env.RATELIMIT === "ON") {
      let ip = (await headers())?.get("x-forwarded-for");
      ip = ip?.split(",")[0]?.trim() ?? null;

      if (!ip) {
        throw new Error("IP not found");
      }

      const { success } = await rateLimit.limit(ip);

      if (!success) {
        throw new Error("Rate limit reached wait for some time and try again.");
      }
    }

    const playerId = formData.get("playerId") as string;
    const rawName = formData.get("username") as string;
    const cleanedName = rawName.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30);

    if (!cleanedName) {
      throw new Error("Display name is required");
    }

    const player = await prisma.player.update({
      where: { id: playerId },
      data: {
        name: cleanedName,
      },
    });

    if (!player) {
      throw new Error("Player not found");
    }

    return { playerId: player.id, name: player.name };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Something went wrong" };
  }
};

export default updatePlayerName;
