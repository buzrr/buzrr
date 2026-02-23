"use server";
import { prisma } from "@buzrr/prisma";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "@/server/upstash";
import { headers } from "next/headers";

const rateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, "120s"),
});

const createPlayer = async (formData: FormData) => {
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

    const name = formData.get("username") as string;
    const profilePic = formData.get("profile") as string;

    const player = await prisma.player.create({
      data: {
        name,
        profilePic,
      },
    });

    return { playerId: player.id };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Something went wrong" };
  }
};

export default createPlayer;
