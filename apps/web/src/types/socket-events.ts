import type { Player } from "./db";

export interface PlayerPayload {
  id: string;
  name?: string;
  profilePic?: string | null;
}

export interface PlayerRemovedPayload extends PlayerPayload {
  /** True when the host banned the player instead of just kicking them. */
  banned?: boolean;
}

// ---------------------------------------------------------------------------
// Contract v2 — the server owns all timing. Clients render countdowns from
// `deadline`, correcting for clock skew via `serverNow`.
// ---------------------------------------------------------------------------

export type GamePhase =
  | "lobby"
  | "starting"
  | "question"
  | "reveal"
  | "final"
  | "ended";

export interface PublicQuestion {
  id: string;
  title: string;
  media: string | null;
  mediaType: string | null;
  timeOut: number;
  options: { id: string; title: string }[];
}

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
  counts: number[];
  correctOptionIds: string[];
}

export interface AnswerResultPayload {
  answered: boolean;
  optionId: string | null;
  isCorrect: boolean;
  score: number;
  totalScore: number;
  rank: number | null;
}

export interface LiveLeaderboardEntry {
  playerId: string;
  name: string;
  profilePic: string | null;
  score: number;
  rank: number;
}

export interface LeaderboardPayload {
  entries: LiveLeaderboardEntry[];
  isFinal: boolean;
}

export interface GameOverPayload {
  entries: LiveLeaderboardEntry[];
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
  question?: PublicQuestion;
  startAt?: number;
  deadline?: number;
  reveal?: QuestionEndPayload;
  leaderboard?: LiveLeaderboardEntry[];
  players: {
    id: string;
    name: string;
    profilePic: string | null;
    connected: boolean;
  }[];
  you?: AnswerResultPayload;
}

export interface SubmitAnswerAck {
  accepted: boolean;
  reason?: string;
}

/** Legacy leaderboard row shape kept for the post-game admin leaderboard page. */
export interface LeaderboardEntry {
  playerId: string;
  position?: number;
  score: number;
  Player?: Pick<Player, "name" | "profilePic">;
}

export interface ServerToClientEvents {
  "duel:matched": (payload: DuelMatchedPayload) => void;
  "duel:queued": (payload: { elo: number }) => void;
  "duel:queue-timeout": () => void;
  "duel:error": (payload: { message: string }) => void;
  "question-start": (payload: QuestionStartPayload) => void;
  "question-end": (payload: QuestionEndPayload) => void;
  "answer-result": (payload: AnswerResultPayload) => void;
  leaderboard: (payload: LeaderboardPayload) => void;
  "game-over": (payload: GameOverPayload) => void;
  "state-sync": (payload: StateSyncPayload) => void;
  "player-connection": (payload: PlayerConnectionPayload) => void;
  "player-joined": (player: PlayerPayload) => void;
  "player-removed": (player: PlayerRemovedPayload) => void;
  /** A player left on their own (distinct from a host kick / player-removed). */
  "player-left": (player: { id: string }) => void;
  "game-started": () => void;
  "game-session-ended": () => void;
}

export interface ClientToServerEvents {
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
  "host-next": () => void;
  "submit-answer": (
    payload: { qIndex: number; optionId: string },
    ack: (result: SubmitAnswerAck) => void,
  ) => void;
  "request-sync": () => void;
  /** A player voluntarily leaves the room (back / leave-game confirmation). */
  "leave-room": () => void;
  "remove-player": (player: { id: string }, gameCode?: string) => void;
  "start-game": (gameCode?: string) => void;
  "end-game-session": (gameCode?: string) => void;
}

export type GameSocket = import("socket.io-client").Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";
