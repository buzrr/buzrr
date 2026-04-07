export interface ServerToClientEvents {
  "player-joined": (player: { id: string; name?: string; profilePic?: string | null }) => void;
  "player-removed": (player: { id: string }) => void;
  "game-started": () => void;
  "timer-starts": () => void;
  "get-question-index": (index: number) => void;
  "question-changed": (index: number) => void;
  "displaying-result": (data: { presenter: number[]; player: { playerId: string; isCorrect: boolean }[] }) => void;
  "displaying-leaderboard": () => void;
  "displaying-final-leaderboard": (entries: unknown[]) => void;
  "game-session-ended": () => void;
}

export interface ClientToServerEvents {
  "remove-player": (player: { id: string }, gameCode: string) => void;
  "start-game": (gameCode: string) => void;
  "start-timer": (gameCode: string) => void;
  "set-question-index": (gameCode: string, index: number) => void;
  "change-question": (gameCode: string, index: number) => void;
  "display-result": (gameCode: string, quesId: string, options: { id: string }[]) => void;
  "display-leaderboard": () => void;
  "final-leaderboard": (gameCode: string) => void;
  "end-game-session": (gameCode: string) => void;
}

export type TypedServer = import("socket.io").Server<ClientToServerEvents, ServerToClientEvents>;
export type TypedSocket = import("socket.io").Socket<ClientToServerEvents, ServerToClientEvents>;
