import type { Player } from "./db";

export interface PlayerPayload {
  id: string;
  name?: string;
  profilePic?: string | null;
}

export interface ResultPayload {
  presenter: number[];
  player: PlayerAnswerResult[];
}

export interface PlayerAnswerResult {
  playerId: string;
  isCorrect: boolean;
}

export interface LeaderboardEntry {
  playerId: string;
  position: number;
  score: number;
  Player?: Pick<Player, "name" | "profilePic">;
}

export interface ServerToClientEvents {
  "player-joined": (player: PlayerPayload) => void;
  "player-removed": (player: PlayerPayload) => void;
  "game-started": () => void;
  "timer-starts": () => void;
  "get-question-index": (index: number) => void;
  "question-changed": (index: number) => void;
  "displaying-result": (data: ResultPayload) => void;
  "displaying-leaderboard": () => void;
  "displaying-final-leaderboard": (entries: LeaderboardEntry[]) => void;
  "game-session-ended": () => void;
}

export interface ClientToServerEvents {
  "remove-player": (player: { id: string }, gameCode: string) => void;
  "start-game": (gameCode: string) => void;
  "start-timer": () => void;
  "set-question-index": (gameCode: string, index: number) => void;
  "change-question": (gameCode: string, index: number) => void;
  "display-result": (
    gameCode: string,
    quesId: string,
    options: { id: string }[],
  ) => void;
  "display-leaderboard": () => void;
  "final-leaderboard": () => void;
  "end-game-session": () => void;
}
