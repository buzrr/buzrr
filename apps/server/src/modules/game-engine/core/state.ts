import type {
  AnswerCountPayload,
  AnswerResultPayload,
  LeaderboardPayload,
  QuestionAnswer,
  QuestionEndPayload,
  QuestionStartPayload,
} from "@buzrr/contract";
import type {
  GameMeta,
  LiveQuestion,
  RosterEntry,
  ScoreEntry,
  StoredAnswer,
} from "../game-engine.types";

/**
 * Everything the phase machine reads, loaded from Redis by the shell
 * (`GameEngineService`) before each step. Not every event needs every part —
 * see `PARTS_FOR` in machine.ts; parts that weren't loaded are empty.
 */
export interface GameState {
  meta: GameMeta;
  questions: LiveQuestion[];
  roster: RosterEntry[];
  /** Stored answers to the question at `meta.qIndex`, by player id. */
  answers: Record<string, StoredAnswer>;
  /** The leaderboard zset, highest score first. */
  scores: ScoreEntry[];
}

export type StatePart = "questions" | "roster" | "answers" | "scores";

/** Who an emitted message goes to. */
export type Audience = { room: true } | { player: string };

/** Messages the core asks the shell to send — a subset of the socket contract. */
export type Outbound =
  | {
      event: "game-started";
      /** When question 1 opens; sent to clients as `remainingMs`. */
      deadline: number;
    }
  | {
      event: "question-start";
      payload: QuestionStartPayload;
      /**
       * The answer deadline. The shell re-derives `remainingMs` from it at
       * send time, so clients are told what is actually left once the writes
       * before the broadcast are done — not the full window.
       */
      deadline: number;
    }
  | { event: "question-end"; payload: QuestionEndPayload }
  | { event: "answer-result"; payload: AnswerResultPayload }
  | { event: "answer-count"; payload: AnswerCountPayload }
  | { event: "leaderboard"; payload: LeaderboardPayload };

/**
 * Side effects, executed by the shell **in order**. Order is load-bearing: the
 * answer window is written before `question-start` goes out, the schedule
 * entry before the phase, personal results before the room's reveal (see
 * docs/architecture/realtime.md).
 */
export type Effect =
  | { kind: "set-questions"; questions: LiveQuestion[] }
  | { kind: "patch-meta"; patch: Partial<GameMeta> }
  /** Write the game's entry in `games:deadlines` (fire-at, epoch ms). */
  | { kind: "set-deadline"; at: number }
  /** Keep the game visible to the sweeper with no deadline of its own. */
  | { kind: "park-deadline" }
  | { kind: "clear-deadline" }
  /** Take the per-game owner lock, so this instance fires its deadlines. */
  | { kind: "claim-owner" }
  /** Arm this instance's local fast-path timer for the deadline. */
  | { kind: "arm-timer"; at: number }
  | { kind: "clear-timer" }
  /** Flip the lobby row's `isPlaying` flag (classic games only). */
  | { kind: "mark-playing" }
  | { kind: "emit"; to: Audience; message: Outbound }
  | {
      kind: "arm-bot";
      botId: string;
      qIndex: number;
      answer: QuestionAnswer;
      at: number;
    }
  | { kind: "cancel-bot" }
  /** Run the end-of-game claim/persist/cleanup path. */
  | { kind: "end-game" }
  /** Step the machine again with a freshly loaded state. */
  | { kind: "dispatch"; event: "close-question"; qIndex: number }
  | { kind: "log"; level: "warn" | "error"; message: string };

export interface Transition {
  state: GameState;
  effects: Effect[];
}

export const ROOM: Audience = { room: true };

export function withMeta(
  state: GameState,
  patch: Partial<GameMeta>,
): GameState {
  return { ...state, meta: { ...state.meta, ...patch } };
}
