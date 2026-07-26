export type GamePhase =
  | "lobby"
  | "starting"
  | "question"
  | "reveal"
  | "final"
  | "ended";

export type GameMode = "classic" | "duel";

export interface GameMeta {
  sessionId: string;
  quizId: string;
  quizTitle: string;
  hostId: string;
  mode: GameMode;
  phase: GamePhase;
  /** Duels only: friend-invite duels are unrated so ratings can't be farmed. */
  rated: boolean;
  qIndex: number;
  qId: string;
  qStartAt: number;
  qDeadline: number;
  qCount: number;
  startedAt: number;
  hostConnected: boolean;
  hostLastSeenAt: number;
}

export interface LiveOption {
  id: string;
  title: string;
  isCorrect: boolean;
}

export interface LiveQuestion {
  id: string;
  title: string;
  media: string | null;
  mediaType: string | null;
  timeOut: number;
  options: LiveOption[];
}

/** Question as sent to clients — correctness stripped. */
export interface PublicQuestion {
  id: string;
  title: string;
  media: string | null;
  mediaType: string | null;
  timeOut: number;
  options: { id: string; title: string }[];
}

export interface RosterEntry {
  id: string;
  name: string;
  profilePic: string | null;
  connected: boolean;
  lastSeenAt: number;
  userId?: string;
}

export interface StoredAnswer {
  optionId: string;
  answeredAt: number;
  timeTakenMs: number;
  isCorrect: boolean;
  score: number;
}

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  profilePic: string | null;
  score: number;
  rank: number;
}

export function toPublicQuestion(q: LiveQuestion): PublicQuestion {
  return {
    id: q.id,
    title: q.title,
    media: q.media,
    mediaType: q.mediaType,
    timeOut: q.timeOut,
    options: q.options.map((o) => ({ id: o.id, title: o.title })),
  };
}
