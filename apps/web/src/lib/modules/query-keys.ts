export const queryKeys = {
  questions: (quizId: string) => ["questions", quizId] as const,
  leaderboard: (gameCode: string) => ["leaderboard", gameCode] as const,
};
