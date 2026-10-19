import type { ModerationListStatus } from "@buzrr/contract";

export const queryKeys = {
  questions: (quizId: string) => ["questions", quizId] as const,
  leaderboard: (gameCode: string) => ["leaderboard", gameCode] as const,
  quizzes: {
    all: ["quizzes"] as const,
    detail: (quizId: string) => ["quizzes", "detail", quizId] as const,
  },
  players: {
    detail: (playerId: string) => ["players", "detail", playerId] as const,
  },
  gameSessions: {
    lobby: (roomId: string) => ["gameSessions", "lobby", roomId] as const,
    history: ["gameSessions", "history"] as const,
    result: (resultId: string) => ["gameSessions", "result", resultId] as const,
    playerPlay: (playerId: string) =>
      ["gameSessions", "playerPlay", playerId] as const,
  },
  solo: {
    all: ["solo"] as const,
    tests: (quizId: string) => ["solo", "tests", quizId] as const,
    report: (id: string) => ["solo", "report", id] as const,
  },
  users: {
    myStats: ["users", "me", "stats"] as const,
  },
  billing: {
    me: ["billing", "me"] as const,
    pricing: (region: string) => ["billing", "pricing", region] as const,
  },
  ai: {
    spaces: ["ai", "spaces"] as const,
    space: (spaceId: string) => ["ai", "spaces", spaceId] as const,
    spaceStatus: (spaceId: string) =>
      ["ai", "spaces", spaceId, "status"] as const,
    runs: (spaceId: string) => ["ai", "spaces", spaceId, "runs"] as const,
    run: (runId: string) => ["ai", "runs", runId] as const,
  },
  moderation: {
    all: ["moderation"] as const,
    queue: (status: ModerationListStatus) =>
      ["moderation", "queue", status] as const,
    counts: ["moderation", "counts"] as const,
  },
  categories: {
    all: ["categories"] as const,
  },
  admins: {
    lists: ["admins", "list"] as const,
    list: (search: string) => ["admins", "list", search] as const,
  },
};
