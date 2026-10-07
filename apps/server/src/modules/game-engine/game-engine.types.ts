import type {
  GameMode,
  GamePhase,
  LeaderboardEntry,
  QuestionAnswer,
} from "@buzrr/contract";
import type { BotTier } from "../../common/utils/duel-bot";

export type { GameMode, GamePhase, LeaderboardEntry };
export type { LiveOption, LiveQuestion } from "../question-types";

/**
 * How a game moves forward — see `core/pacing.ts`. Stored in meta so a game
 * keeps the pacing it started with.
 */
export type PacingMode = "host" | "auto";

export interface GameMeta {
  sessionId: string;
  quizId: string;
  quizTitle: string;
  hostId: string;
  mode: GameMode;
  /** Absent on games created before pacing was explicit; see `pacingFor`. */
  pacing?: PacingMode;
  phase: GamePhase;
  /** Duels only: friend-invite duels are unrated so ratings can't be farmed. */
  rated: boolean;
  /** Set when an empty queue fell back to a bot opponent. */
  botId?: string;
  botTier?: BotTier;
  botElo?: number;
  /**
   * The bot's answer to the open question (JSON), so a restart can re-arm it.
   * Older games stored a bare `botOptionId` instead; `botAnswerOf` reads both.
   */
  botAnswer?: string;
  botOptionId?: string;
  botAnswerAt?: number;
  /**
   * Duels only: when the match was frozen because no human was connected. 0
   * (or absent) means running; resumeDuel shifts every timestamp below by the
   * span it was held for.
   */
  pausedAt?: number;
  qIndex: number;
  qId: string;
  qStartAt: number;
  qDeadline: number;
  qCount: number;
  startedAt: number;
  hostConnected: boolean;
  hostLastSeenAt: number;
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
  /** The answer as the question's type defines it (checked before storing). */
  answer: QuestionAnswer;
  answeredAt: number;
  timeTakenMs: number;
  isCorrect: boolean;
  score: number;
}

export interface ScoreEntry {
  playerId: string;
  score: number;
}
