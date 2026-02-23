/**
 * Type-only re-exports from Prisma for use in client components.
 * Import from "@/types/db" in "use client" components so the Prisma runtime
 * is never bundled into client JS (reduces client bundle and prevents deployment bloat).
 */
export type {
  GameSession,
  Option,
  Quiz,
  Question,
  Player,
  GameLeaderboard,
  PlayerAnswer,
} from "@buzrr/prisma";
