import type {
  GamePhase,
  LeaderboardEntry,
  PublicQuestion,
} from "../game-engine/game-engine.types";

// ---------------------------------------------------------------------------
// Contract v2 payloads. The server owns all timing: clients render countdowns
// from `deadline`, correcting for clock skew via `serverNow`.
// ---------------------------------------------------------------------------

export interface QuestionStartPayload {
  index: number;
  qCount: number;
  question: PublicQuestion;
  startAt: number;
  deadline: number;
  serverNow: number;
}

export interface QuestionEndPayload {
  index: number;
  /** Answer counts aligned with the question's option order. */
  counts: number[];
  correctOptionIds: string[];
}

/** Personal outcome, emitted to the per-player room `player:{id}`. */
export interface AnswerResultPayload {
  answered: boolean;
  optionId: string | null;
  isCorrect: boolean;
  score: number;
  totalScore: number;
  rank: number | null;
}

export interface LeaderboardPayload {
  entries: LeaderboardEntry[];
  isFinal: boolean;
}

export interface GameOverPayload {
  entries: LeaderboardEntry[];
  resultId?: string;
  /** Duels only: rating change per playerId. */
  eloChanges?: Record<string, { before: number; after: number }>;
  /** True only for rated duels; friend invites are unrated. */
  rated?: boolean;
}

export interface DuelMatchedPayload {
  gameCode: string;
  opponent: {
    id: string;
    name: string;
    profilePic: string | null;
    elo: number;
  };
}

export type DuelInviteFailure =
  | "not-found"
  | "claimed"
  | "self"
  | "host-offline"
  | "busy"
  | "no-questions"
  | "error";

export interface DuelInviteAcceptAck {
  ok: boolean;
  reason?: DuelInviteFailure;
  /** Present when ok — clients normally navigate on `duel:matched` instead. */
  gameCode?: string;
}

export interface PlayerConnectionPayload {
  playerId: string;
  connected: boolean;
}

export interface StateSyncPayload {
  phase: GamePhase;
  mode: "classic" | "duel";
  qIndex: number;
  qCount: number;
  serverNow: number;
  /** Present while phase is "question". */
  question?: PublicQuestion;
  startAt?: number;
  deadline?: number;
  /** Present while phase is "reveal". */
  reveal?: QuestionEndPayload;
  /** Present while phase is "final" or "ended". */
  leaderboard?: LeaderboardEntry[];
  players: {
    id: string;
    name: string;
    profilePic: string | null;
    connected: boolean;
  }[];
  /** Present for player connections only. */
  you?: AnswerResultPayload;
}

export interface SubmitAnswerAck {
  accepted: boolean;
  reason?: string;
}

export interface ServerToClientEvents {
  // -- contract v2 --
  "question-start": (payload: QuestionStartPayload) => void;
  "question-end": (payload: QuestionEndPayload) => void;
  "answer-result": (payload: AnswerResultPayload) => void;
  leaderboard: (payload: LeaderboardPayload) => void;
  "game-over": (payload: GameOverPayload) => void;
  "state-sync": (payload: StateSyncPayload) => void;
  "player-connection": (payload: PlayerConnectionPayload) => void;
  // -- duel matchmaking --
  "duel:matched": (payload: DuelMatchedPayload) => void;
  "duel:queued": (payload: { elo: number }) => void;
  "duel:queue-timeout": () => void;
  "duel:error": (payload: { message: string }) => void;
  // -- shared with v1 --
  "player-joined": (player: {
    id: string;
    name?: string;
    profilePic?: string | null;
  }) => void;
  "player-removed": (player: {
    id: string;
    name?: string;
    profilePic?: string | null;
  }) => void;
  /** A player left on their own (distinct from a host kick / player-removed). */
  "player-left": (player: {
    id: string;
    name?: string;
    profilePic?: string | null;
  }) => void;
  "game-started": () => void;
  // -- legacy v1 (dual-emitted until the web client is fully migrated) --
  "timer-starts": () => void;
  "get-question-index": (index: number) => void;
  "question-changed": (index: number) => void;
  "displaying-result": (data: {
    presenter: number[];
    player: { playerId: string; isCorrect: boolean }[];
  }) => void;
  "displaying-leaderboard": () => void;
  "displaying-final-leaderboard": (entries: unknown[]) => void;
  "game-session-ended": () => void;
}

export interface ClientToServerEvents {
  // -- duel matchmaking --
  "duel:queue": () => void;
  "duel:cancel": () => void;
  /**
   * The invited friend claims a pending invite. Emitted on the guest's own
   * already-connected invite socket so `duel:matched` can't race ahead of it.
   */
  "duel:invite-accept": (
    payload: { code: string },
    ack: (result: DuelInviteAcceptAck) => void,
  ) => void;
  // -- contract v2 --
  "host-next": () => void;
  "submit-answer": (
    payload: { qIndex: number; optionId: string },
    ack: (result: SubmitAnswerAck) => void,
  ) => void;
  "request-sync": () => void;
  /** A player voluntarily leaves the room (back / leave-game confirmation). */
  "leave-room": () => void;
  // -- shared with v1 --
  "remove-player": (player: { id: string }, gameCode?: string) => void;
  "start-game": (gameCode?: string) => void;
  "end-game-session": (gameCode?: string) => void;
  // -- legacy v1 (accepted as aliases until the web client is fully migrated) --
  "start-timer": (gameCode?: string) => void;
  "set-question-index": (gameCode: string, index: number) => void;
  "change-question": (gameCode: string, index: number) => void;
  "display-result": (
    gameCode: string,
    quesId: string,
    options: { id: string }[],
  ) => void;
  "display-leaderboard": () => void;
  "final-leaderboard": (gameCode?: string) => void;
}

export interface SocketData {
  gameCode: string;
  gameSessionId: string;
  isRoomHost: boolean;
  playerId: string | null;
  /** Set on duel-queue connections (no gameCode). */
  duelUserId?: string;
  /**
   * Set on duel-invite waiting-room connections (`intent=invite`). Doubles as
   * the presence signal that the host is sitting on the invite page.
   */
  duelInviteCode?: string;
}

export type TypedServer = import("socket.io").Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
export type TypedSocket = import("socket.io").Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
