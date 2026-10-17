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
  // Moderated games only (see moderationSettingsSchema):
  /** "Get ready" slide before a question, waiting for the host. */
  "ready",
  /** The question closed; the answer waits for the host's "show answer". */
  "closed",
  /** Standings after a question, shown on the host's "show scores". */
  "scores",
]);

/**
 * Moderated mode (a quiz setting): the host steps the room through every
 * question — get-ready slide, countdown, question, answer, scores. Each
 * `confirm*` makes that step wait for the host instead of following on its
 * own. Off by default.
 */
export const moderationSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  /** Reveal the correct answer after each question. */
  showAnswer: z.boolean().default(true),
  /** ...only when the host clicks "Show answer". */
  confirmShowAnswer: z.boolean().default(true),
  /** Show the standings after every question. */
  showScores: z.boolean().default(true),
  /** ...only when the host clicks "Show scores" (after the answer). */
  confirmShowScores: z.boolean().default(true),
  /** A "get ready" slide before each question that the host starts. */
  confirmNextQuestion: z.boolean().default(true),
});

/** `Quiz.settings`. Unknown/missing keys fall back to the defaults. */
export const quizSettingsSchema = z.object({
  moderation: moderationSettingsSchema.prefault({}),
  /** Players can send live reactions (👍 ❤️ 😂) that fly across the host screen. */
  reactions: z.boolean().default(true),
});

/** Live reactions a player can send (see `reaction` events). */
export const reactionKindSchema = z.enum(["thumbs", "heart", "laugh"]);
export const reactionSchema = z.object({ kind: reactionKindSchema });
export const playerReactionSchema = reactionSchema.extend({
  playerId: z.string(),
});

/** A moderated game moved to a phase that has no payload event of its own. */
export const phaseChangeSchema = z.object({
  phase: gamePhaseSchema,
  qIndex: z.number().int(),
  /** "starting": time until the question opens (display only). */
  remainingMs: z.number().optional(),
});
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

/**
 * How the room is answering an unscored question (poll, word cloud, …),
 * sent to the host only (`host:{gameCode}`) at most about once a second while
 * the question is open. Best effort: keep the payload with the highest
 * `answered` for the open `index`.
 */
export const liveSummarySchema = z.object({
  index: z.number().int(),
  answered: z.number().int(),
  summary: revealSummarySchema,
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

/** A duel's category; null means Random. */
export const duelCategoryRefSchema = z
  .object({ id: z.string(), name: z.string() })
  .nullable();

const streakChangesSchema = z.record(
  z.string(),
  z.object({
    current: z.number(),
    best: z.number(),
    /** False when the player had already counted a duel today. */
    advanced: z.boolean(),
  }),
);

export const gameOverSchema = z.object({
  entries: z.array(leaderboardEntrySchema),
  resultId: z.string().optional(),
  /** Duels only: rating change per playerId. */
  eloChanges: eloChangesSchema.optional(),
  /** True only for rated duels; friend invites are unrated. */
  rated: z.boolean().optional(),
  /** Duels only: the category played (null = Random). */
  category: duelCategoryRefSchema.optional(),
  /** Duels only: daily-streak state per signed-in playerId after this duel. */
  streaks: streakChangesSchema.optional(),
});

export const duelMatchedSchema = z.object({
  gameCode: z.string(),
  opponent: z.object({
    id: z.string(),
    name: z.string(),
    profilePic: z.string().nullable(),
    elo: z.number(),
  }),
  category: duelCategoryRefSchema,
  questionCount: z.number(),
});

/** `duel:queue` — which pool to search; null/omitted means Random. */
export const duelQueueSchema = z
  .object({ categoryId: z.string().min(1).nullable().optional() })
  .optional();

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
  /** Present for moderated games. */
  moderation: moderationSettingsSchema.optional(),
});

export const submitAnswerSchema = z.object({
  qIndex: z.number().int().nonnegative(),
  answer: questionAnswerSchema,
});

export const submitAnswerAckSchema = z.object({
  accepted: z.boolean(),
  reason: z.string().optional(),
  /**
   * The player's answer as now stored. For a question that takes several
   * submissions this is everything they have sent so far.
   */
  answer: questionAnswerSchema.optional(),
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

/**
 * The lobby's bubble mini-game: a player's running totals, sent about once a
 * second while they wait; relayed to the host only (`host:{gameCode}`).
 */
export const bubbleStatsSchema = z.object({
  hits: z.number().int().min(0).max(1_000_000),
  misses: z.number().int().min(0).max(1_000_000),
});
export const playerBubbleStatsSchema = bubbleStatsSchema.extend({
  playerId: z.string(),
});

export const duelInviteAcceptSchema = z.object({ code: z.string().min(1) });
export const removePlayerSchema = z.object({ id: z.string().min(1) });

// -- inferred types -----------------------------------------------------------

export type GamePhase = z.infer<typeof gamePhaseSchema>;
export type ModerationSettings = z.infer<typeof moderationSettingsSchema>;
export type QuizSettings = z.infer<typeof quizSettingsSchema>;
export type PhaseChangePayload = z.infer<typeof phaseChangeSchema>;
export type BubbleStatsPayload = z.infer<typeof bubbleStatsSchema>;
export type ReactionKind = z.infer<typeof reactionKindSchema>;
export type ReactionPayload = z.infer<typeof reactionSchema>;
export type PlayerReactionPayload = z.infer<typeof playerReactionSchema>;
export type PlayerBubbleStatsPayload = z.infer<typeof playerBubbleStatsSchema>;
export type GameMode = z.infer<typeof gameModeSchema>;
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export type QuestionStartPayload = z.infer<typeof questionStartSchema>;
export type QuestionEndPayload = z.infer<typeof questionEndSchema>;
export type AnswerCountPayload = z.infer<typeof answerCountSchema>;
export type LiveSummaryPayload = z.infer<typeof liveSummarySchema>;
export type AnswerResultPayload = z.infer<typeof answerResultSchema>;
export type LeaderboardPayload = z.infer<typeof leaderboardSchema>;
export type GameOverPayload = z.infer<typeof gameOverSchema>;
export type DuelMatchedPayload = z.infer<typeof duelMatchedSchema>;
export type DuelQueuePayload = z.infer<typeof duelQueueSchema>;
export type DuelCategoryRef = z.infer<typeof duelCategoryRefSchema>;
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
  "live-summary": (payload: LiveSummaryPayload) => void;
  leaderboard: (payload: LeaderboardPayload) => void;
  "game-over": (payload: GameOverPayload) => void;
  "state-sync": (payload: StateSyncPayload) => void;
  /** Moderated games: ready / starting (countdown) / closed / scores. */
  "phase-change": (payload: PhaseChangePayload) => void;
  /** Host only: a waiting player's bubble mini-game totals. */
  "bubble-stats": (payload: PlayerBubbleStatsPayload) => void;
  /** Host only: one live reaction from a player (one per tap). */
  reaction: (payload: PlayerReactionPayload) => void;
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
  /**
   * `remainingMs`: time until the first question opens (display only; 0 for a
   * moderated game that starts on its get-ready slide). `moderation`: present
   * for moderated games.
   */
  "game-started": (payload: {
    remainingMs: number;
    moderation?: ModerationSettings;
  }) => void;
  /** Terminal signal for players: the room is gone, stop rendering it. */
  "game-session-ended": () => void;
}

export interface ClientToServerEvents {
  // -- duel matchmaking --
  "duel:queue": (payload?: DuelQueuePayload) => void;
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
  /** A waiting player's bubble mini-game totals (about once a second). */
  "bubble-stats": (payload: BubbleStatsPayload) => void;
  /** One tap on a reaction button (rate limited server-side). */
  reaction: (payload: ReactionPayload) => void;
  // -- host intents (the server decides what each one means) --
  "remove-player": (player: { id: string }, gameCode?: string) => void;
  "start-game": (gameCode?: string) => void;
  "end-game-session": (gameCode?: string) => void;
}
