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
    leaderboardRoom: (roomId: string) =>
      ["gameSessions", "leaderboardRoom", roomId] as const,
    playerPlay: (playerId: string) =>
      ["gameSessions", "playerPlay", playerId] as const,
  },
};
