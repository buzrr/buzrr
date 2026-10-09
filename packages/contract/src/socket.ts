import { z } from "zod";
import {
  publicQuestionSchema,
  questionAnswerSchema,
  revealSummarySchema,
} from "./question-types";

// ---------------------------------------------------------------------------
// Socket contract. The server owns all timing: deadlines go out as
// `remainingMs` durations, so clients count down on their own clock and never
// need to compare timestamps across machines.
//
// This file is the only definition of the contract — the server and the web
// client both import it. There is exactly one version (ADR-002): change it
// here and migrate both apps in the same change.
// ---------------------------------------------------------------------------

export const gamePhaseSchema = z.enum([
  "lobby",
  "starting",
  "question",
  "reveal",
  "final",
  "ended",
]);
export const gameModeSchema = z.enum(["classic", "duel"]);

export const leaderboardEntrySchema = z.object({
  playerId: z.string(),
  name: z.string(),
  profilePic: z.string().nullable(),
  score: z.number(),
  rank: z.number().int(),
  /** Points earned on the question just revealed; absent outside a reveal. */
  delta: z.number().optional(),
});

export const questionStartSchema = z.object({
  index: z.number().int(),
  qCount: z.number().int(),
  question: publicQuestionSchema,
  /** Time left to answer, as of this event being sent. */
  remainingMs: z.number(),
});

export const questionEndSchema = z.object({
  index: z.number().int(),
  /** What the question's type reveals: counts, correct answers, … */
  summary: revealSummarySchema,
  /** Mean answer time across everyone who answered; null when nobody did. */
  avgTimeMs: z.number().nullable(),
});

/** Answers received so far for the open question (classic host meter). */
export const answerCountSchema = z.object({
  index: z.number().int(),
  answered: z.number().int(),
});

/** Personal outcome, emitted to the per-player room `player:{id}`. */
export const answerResultSchema = z.object({
  answered: z.boolean(),
  /** The answer the server stored for this player, if any. */
  answer: questionAnswerSchema.nullable(),
  isCorrect: z.boolean(),
  score: z.number(),
  totalScore: z.number(),
  rank: z.number().int().nullable(),
});

export const leaderboardSchema = z.object({
  entries: z.array(leaderboardEntrySchema),
  isFinal: z.boolean(),
});

const eloChangesSchema = z.record(
  z.string(),
  z.object({ before: z.number(), after: z.number() }),
);

export const gameOverSchema = z.object({
  entries: z.array(leaderboardEntrySchema),
  resultId: z.string().optional(),
  /** Duels only: rating change per playerId. */
  eloChanges: eloChangesSchema.optional(),
  /** True only for rated duels; friend invites are unrated. */
  rated: z.boolean().optional(),
});

export const duelMatchedSchema = z.object({
  gameCode: z.string(),
  opponent: z.object({
    id: z.string(),
    name: z.string(),
    profilePic: z.string().nullable(),
    elo: z.number(),
  }),
});

export const duelInviteFailureSchema = z.enum([
  "not-found",
  "claimed",
  "self",
  "host-offline",
  "busy",
  "no-questions",
  "error",
]);

export const duelInviteAcceptAckSchema = z.object({
  ok: z.boolean(),
  reason: duelInviteFailureSchema.optional(),
  /** Present when ok — clients normally navigate on `duel:matched` instead. */
  gameCode: z.string().optional(),
});

export const playerConnectionSchema = z.object({
  playerId: z.string(),
  connected: z.boolean(),
});

export const rosterPlayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  profilePic: z.string().nullable(),
  connected: z.boolean(),
});

export const stateSyncSchema = z.object({
  phase: gamePhaseSchema,
  mode: gameModeSchema,
  qIndex: z.number().int(),
  qCount: z.number().int(),
  /** Present while phase is "question" or "reveal". */
  question: publicQuestionSchema.optional(),
  /** Present while phase is "question": time left, as of this snapshot. */
  remainingMs: z.number().optional(),
  /** Present while phase is "question": answers received so far. */
  answeredCount: z.number().int().optional(),
  /** Present while phase is "reveal". */
  reveal: questionEndSchema.optional(),
  /** Present while phase is "reveal", "final" or "ended". */
  leaderboard: z.array(leaderboardEntrySchema).optional(),
  players: z.array(rosterPlayerSchema),
  /** Present for player connections only. */
  you: answerResultSchema.optional(),
});

export const submitAnswerSchema = z.object({
  qIndex: z.number().int().nonnegative(),
  answer: questionAnswerSchema,
});

export const submitAnswerAckSchema = z.object({
  accepted: z.boolean(),
  reason: z.string().optional(),
});

/** A roster member as announced on join/leave/kick. */
export const playerRefSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  profilePic: z.string().nullable().optional(),
});

export const playerRemovedSchema = playerRefSchema.extend({
  /** True when the host banned the player instead of just kicking them. */
  banned: z.boolean().optional(),
});

export const duelInviteAcceptSchema = z.object({ code: z.string().min(1) });
export const removePlayerSchema = z.object({ id: z.string().min(1) });

// -- inferred types -----------------------------------------------------------

export type GamePhase = z.infer<typeof gamePhaseSchema>;
export type GameMode = z.infer<typeof gameModeSchema>;
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export type QuestionStartPayload = z.infer<typeof questionStartSchema>;
export type QuestionEndPayload = z.infer<typeof questionEndSchema>;
export type AnswerCountPayload = z.infer<typeof answerCountSchema>;
export type AnswerResultPayload = z.infer<typeof answerResultSchema>;
export type LeaderboardPayload = z.infer<typeof leaderboardSchema>;
export type GameOverPayload = z.infer<typeof gameOverSchema>;
export type DuelMatchedPayload = z.infer<typeof duelMatchedSchema>;
export type DuelInviteFailure = z.infer<typeof duelInviteFailureSchema>;
export type DuelInviteAcceptAck = z.infer<typeof duelInviteAcceptAckSchema>;
export type PlayerConnectionPayload = z.infer<typeof playerConnectionSchema>;
export type RosterPlayer = z.infer<typeof rosterPlayerSchema>;
export type StateSyncPayload = z.infer<typeof stateSyncSchema>;
export type SubmitAnswerPayload = z.infer<typeof submitAnswerSchema>;
export type SubmitAnswerAck = z.infer<typeof submitAnswerAckSchema>;
export type PlayerPayload = z.infer<typeof playerRefSchema>;
export type PlayerRemovedPayload = z.infer<typeof playerRemovedSchema>;

// -- event maps -----------------------------------------------------------------

export interface ServerToClientEvents {
  // -- gameplay --
  "question-start": (payload: QuestionStartPayload) => void;
  "question-end": (payload: QuestionEndPayload) => void;
  "answer-result": (payload: AnswerResultPayload) => void;
  "answer-count": (payload: AnswerCountPayload) => void;
  leaderboard: (payload: LeaderboardPayload) => void;
  "game-over": (payload: GameOverPayload) => void;
  "state-sync": (payload: StateSyncPayload) => void;
  "player-connection": (payload: PlayerConnectionPayload) => void;
  // -- duel matchmaking --
  "duel:matched": (payload: DuelMatchedPayload) => void;
  "duel:queued": (payload: { elo: number }) => void;
  "duel:queue-timeout": () => void;
  "duel:error": (payload: { message: string }) => void;
  // -- roster & lifecycle --
  "player-joined": (player: PlayerPayload) => void;
  "player-removed": (player: PlayerRemovedPayload) => void;
  /** A player left on their own (distinct from a host kick / player-removed). */
  "player-left": (player: PlayerPayload) => void;
  /** `remainingMs`: time until the first question opens (display only). */
  "game-started": (payload: { remainingMs: number }) => void;
  /** Terminal signal for players: the room is gone, stop rendering it. */
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
    payload: z.infer<typeof duelInviteAcceptSchema>,
    ack: (result: DuelInviteAcceptAck) => void,
  ) => void;
  // -- gameplay --
  "host-next": () => void;
  "submit-answer": (
    payload: SubmitAnswerPayload,
    ack: (result: SubmitAnswerAck) => void,
  ) => void;
  "request-sync": () => void;
  /** A player voluntarily leaves the room (back / leave-game confirmation). */
  "leave-room": () => void;
  // -- host intents (the server decides what each one means) --
  "remove-player": (player: { id: string }, gameCode?: string) => void;
  "start-game": (gameCode?: string) => void;
  "end-game-session": (gameCode?: string) => void;
}
