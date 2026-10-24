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
  /**
   * The correct answer is always revealed (no longer an option): whatever an
   * older quiz stored, this reads as true.
   */
  showAnswer: z
    .boolean()
    .default(true)
    .transform(() => true as const),
  /** The answer is revealed only when the host clicks "Show answer". */
  confirmShowAnswer: z.boolean().default(true),
  /** Show the standings after every question. */
  showScores: z.boolean().default(true),
  /** ...only when the host clicks "Show scores" (after the answer). */
  confirmShowScores: z.boolean().default(true),
  /** A "get ready" slide before the first question that the host starts. */
  confirmNextQuestion: z.boolean().default(true),
});

/** Where question sounds play: the host's screen, the players' devices, both, or nowhere. */
export const soundPlayOnSchema = z.enum(["host", "players", "both", "off"]);

/** A quiz's sounds: where its questions' own sounds play. */
export const soundSettingsSchema = z.object({
  playOn: soundPlayOnSchema.default("host"),
  /** With sounds on the host only: players may switch them on for themselves. */
  playerOptIn: z.boolean().default(true),
});

/** `Quiz.settings`. Unknown/missing keys fall back to the defaults. */
export const quizSettingsSchema = z.object({
  sound: soundSettingsSchema.prefault({}),
  moderation: moderationSettingsSchema.prefault({}),
  /** Players can send live reactions (👍 ❤️ 😂) that fly across the host screen. */
  reactions: z.boolean().default(true),
});

/**
 * A live reaction: one emoji (the player picks their three; defaults
 * 👍 ❤️ 😂). Only emoji characters (incl. ZWJ sequences, skin tones,
 * variation selectors) are accepted, so it can't carry text.
 */
export const reactionSchema = z.object({
  emoji: z
    .string()
    .min(1)
    .max(16)
    .regex(/^[\p{Extended_Pictographic}\p{Emoji_Component}\u200d\ufe0f]+$/u)
    .refine((s) => /\p{Extended_Pictographic}/u.test(s), "Not an emoji"),
  /**
   * Meant for the player's row on the host's board (a right answer at the
   * reveal, or the scores step's top players): shown there, not only flown.
   */
  board: z.boolean().optional(),
});
/**
 * Reactions: a player may send `reactionLimitFor(players in the room)`
 * within REACTION_WINDOW_MS, then waits. The budget is per player and starts
 * afresh with every question and at the final standings.
 */
export const REACTION_WINDOW_MS = 60_000;
export function reactionLimitFor(players: number): number {
  if (players < 50) return 30;
  if (players < 150) return 10;
  if (players < 500) return 5;
  return 2;
}
/**
 * The room's current reaction budget; `reset`: start counting afresh.
 * `limit` 0 = no limit: the top three on the final standings (`winner`)
 * may send as many as they like.
 */
export interface ReactionLimitPayload {
  limit: number;
  windowMs: number;
  reset?: boolean;
  winner?: boolean;
  /** How many are in the room (its reaction limit follows it). */
  players?: number;
}

export const playerReactionSchema = reactionSchema.extend({
  playerId: z.string(),
});

/** A moderated game moved to a phase that has no payload event of its own. */
export const phaseChangeSchema = z.object({
  phase: gamePhaseSchema,
  qIndex: z.number().int(),
  /** "starting": time until the question opens (display only). */
  remainingMs: z.number().optional(),
  /** "starting", countdown over: devices still downloading the question's sound. */
  waitingFor: z.number().int().optional(),
  /** With `waitingFor`: devices that report this question's download, and how many are done. */
  downloadDevices: z.number().int().optional(),
  downloadsDone: z.number().int().optional(),
  /** With `waitingFor`: the host chose to wait until every download is done. */
  waitAll: z.boolean().optional(),
});

/**
 * What a download slot is for: a question's sound clips, or everything ahead
 * (fetched once, in the lobby). Each kind has its own MAX_PARALLEL_DOWNLOADS
 * per room.
 */
export const downloadKindSchema = z.enum(["question", "lobby"]);
export type DownloadKind = z.infer<typeof downloadKindSchema>;

/** A device asks for one of the room's download slots (`preload-slot`). */
export const preloadSlotSchema = z.object({
  /** The question (kind "question"); 0 for the lobby. */
  qIndex: z.number().int().nonnegative(),
  kind: downloadKindSchema.default("question"),
});
/** The device is done with its slot (the lobby's; questions report `preload-status`). */
export const slotDoneSchema = preloadSlotSchema;
/**
 * `go`: start downloading now. Otherwise wait for `preload-go` — the server
 * hands out at most MAX_PARALLEL_DOWNLOADS slots per room at a time.
 * `limited`: slots are rationed (the device needn't spread its start itself).
 */
export interface PreloadSlotAck {
  go: boolean;
  limited: boolean;
}
/** The host's answer while the countdown waits for downloads. */
export const downloadsDecisionSchema = z.object({
  /** true = wait until every device is done (no time limit), false = open the question now. */
  wait: z.boolean(),
});
export type DownloadsDecisionPayload = z.infer<typeof downloadsDecisionSchema>;

/** A device's download progress for question `qIndex`'s sound clips. */
export const preloadStatusSchema = z.object({
  qIndex: z.number().int().nonnegative(),
  loaded: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  done: z.boolean(),
  /** Done, but a clip couldn't be fetched (it won't play on this device). */
  failed: z.boolean().optional(),
});
export const gameModeSchema = z.enum(["classic", "duel"]);

/**
 * Ranks for scores sorted high to low. Equal scores share a rank and the
 * next score down is one place below: 900, 500, 500, 0 → 1, 2, 2, 3.
 */
export function denseRanks(scoresHighToLow: readonly number[]): number[] {
  let rank = 0;
  return scoresHighToLow.map((score, i) => {
    if (i === 0 || score !== scoresHighToLow[i - 1]) rank++;
    return rank;
  });
}

export const leaderboardEntrySchema = z.object({
  playerId: z.string(),
  name: z.string(),
  profilePic: z.string().nullable(),
  score: z.number(),
  /** Shared by equal scores (see `denseRanks`). */
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
  /** Decrypts the question sound's reveal clip (see `questionAudioSchema`). */
  audioRevealKey: z.string().optional(),
  /** Scored questions: the (up to) three quickest right answers. */
  fastest: z
    .array(
      z.object({
        playerId: z.string(),
        name: z.string(),
        profilePic: z.string().nullable(),
        timeMs: z.number(),
      }),
    )
    .optional(),
});

/**
 * Sent ahead (during the previous question's reveal / scores, the get-ready
 * slide or the countdown): the next question's sound clips to download now.
 * They are encrypted — the keys come with the question and its reveal.
 */
export const preloadSchema = z.object({
  qIndex: z.number().int(),
  /** The question sound's encrypted clips. */
  urls: z.array(z.string()),
  /** Its encrypted picture: every device loads it (it shows everywhere). */
  images: z.array(z.string()).optional(),
  /** The question sound's own placement, so devices that won't play it skip the download. */
  playOn: z.enum(["quiz", "host", "players", "both", "off"]),
});

/**
 * Everything encrypted a device can load ahead (every question's clips and
 * picture), sent when it joins the lobby — and to anyone joining later.
 */
export const preloadAllSchema = z.object({
  questions: z.array(preloadSchema),
});
export type PreloadAllPayload = z.infer<typeof preloadAllSchema>;

/** A device's progress on `preload-all` (files, not bytes); done counts failures too. */
export const assetsStatusSchema = z.object({
  loaded: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  done: z.boolean(),
  failed: z.boolean().optional(),
});
export type AssetsStatusPayload = z.infer<typeof assetsStatusSchema>;

/**
 * Host lobby: how many connected players have everything (`ready` of
 * `total`), how many are still downloading (`pending`; quiet ones don't
 * count), and from when the host may start anyway (`forceAt`, epoch ms; 0
 * = no wait). The start button waits for `pending` 0 or `forceAt`.
 */
export interface LobbyReadyPayload {
  ready: number;
  total: number;
  pending: number;
  forceAt: number;
}

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
  /**
   * Place on the board (see `denseRanks`). While a question is open this is
   * the standing as of the last reveal, so it gives nothing away.
   */
  rank: z.number().int().nullable(),
  /** How long this player took to answer (server-measured), if they did. */
  timeTakenMs: z.number().nullable().optional(),
});

/**
 * Players are sent only the top of a room's leaderboard (the host all of it):
 * the whole board to everyone grows with the room twice over — entries times
 * recipients — and held up the events behind it. A player's own standing
 * comes with `answer-result`.
 */
export const PLAYER_LEADERBOARD_TOP = 10;

/**
 * The host is sent the top this many — after a question also whoever was
 * up there before it, so their move down can be shown. A room of hundreds
 * renders no more rows than that.
 */
export const HOST_LEADERBOARD_TOP = 50;

/** On the scores step the top this many may each send one emoji, shown on their row. */
export const SCORES_EMOJI_TOP = 20;

export const leaderboardSchema = z.object({
  entries: z.array(leaderboardEntrySchema),
  /** How many players there are, when `entries` is only the top. */
  total: z.number().int().optional(),
  isFinal: z.boolean(),
  /**
   * Final leaderboard: ms until the host's board has re-sorted and filled
   * the podium (`finalRevealMs`) — players see their place then.
   */
  revealInMs: z.number().int().nonnegative().optional(),
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
  /** Players: how many are on the board when `leaderboard` is only the top (and their own row). */
  leaderboardTotal: z.number().int().optional(),
  players: z.array(rosterPlayerSchema),
  /** Present for player connections only. */
  you: answerResultSchema.optional(),
  /** Present for moderated games. */
  moderation: moderationSettingsSchema.optional(),
  /** Host connections in "closed": the answers so far (see `closed-summary`). */
  closedSummary: questionEndSchema.optional(),
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
  /** Accepted first answers: how long the player took (server-measured). */
  timeTakenMs: z.number().optional(),
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
  /** Not the host's doing: the player's device went quiet in the lobby. */
  timedOut: z.boolean().optional(),
});

/**
 * Players' devices send `heartbeat` this often. A socket that has sent one
 * and then stays quiet for `HEARTBEAT_TIMEOUT_MS` (three missed beats) is
 * dropped and the player shows as offline; in the lobby, a player gone that
 * long after their last beat leaves the list (and is back if they return).
 */
export const HEARTBEAT_INTERVAL_MS = 10_000;
export const HEARTBEAT_TIMEOUT_MS = 35_000;

/**
 * The lobby's bubble mini-game: a player's running totals, sent about once a
 * second while they wait; relayed to the host only (`host:{gameCode}`).
 */
/**
 * Lobby bubble totals: a device reports at most once a second, and only
 * when they changed — in a room of BUBBLE_CROWD or more at most every
 * BUBBLE_CROWD_EVERY_MS. The same boundary as a reaction-limit step, so
 * devices hear the room size when it is crossed.
 */
export const BUBBLE_CROWD = 150;
export const BUBBLE_CROWD_EVERY_MS = 10_000;

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
export type SoundPlayOn = z.infer<typeof soundPlayOnSchema>;
export type SoundSettings = z.infer<typeof soundSettingsSchema>;
export type PhaseChangePayload = z.infer<typeof phaseChangeSchema>;
export type PreloadPayload = z.infer<typeof preloadSchema>;
export type PreloadStatusPayload = z.infer<typeof preloadStatusSchema>;
export type BubbleStatsPayload = z.infer<typeof bubbleStatsSchema>;
export type ReactionPayload = z.infer<typeof reactionSchema>;
export type PlayerReactionPayload = z.infer<typeof playerReactionSchema>;
export type PlayerBubbleStatsPayload = z.infer<typeof playerBubbleStatsSchema>;
export type BubbleStatsBatchPayload = {
  players: Record<string, BubbleStatsPayload>;
};
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
  /** Download the next question's (encrypted) sound clips now. */
  preload: (payload: PreloadPayload) => void;
  /** Everything to load ahead, on joining the lobby (see `assets-status`). */
  "preload-all": (payload: PreloadAllPayload) => void;
  /** Host only: the lobby's download readiness, at most once a second. */
  "lobby-ready": (payload: LobbyReadyPayload) => void;
  /** This device's download slot for question `qIndex` is free (see `preload-slot`). */
  "preload-go": (payload: { qIndex: number; kind?: DownloadKind }) => void;
  /**
   * Host only, moderated "closed" step: how the room answered, before the
   * answer is shown (the host screen keeps the correct one hidden).
   */
  "closed-summary": (payload: QuestionEndPayload) => void;
  /** Host only: a waiting player's bubble mini-game totals. */
  /**
   * Host only: the bubble totals of every player that changed since the
   * last batch — at most one event a second per room.
   */
  "bubble-stats-batch": (payload: BubbleStatsBatchPayload) => void;
  /** Host only: one live reaction from a player (one per tap). */
  reaction: (payload: PlayerReactionPayload) => void;
  /** Players: the room's reaction budget (on join, and afresh per question). */
  "reaction-limit": (payload: ReactionLimitPayload) => void;
  /** Players: that reaction was over the budget; try again in `retryInMs`. */
  "reaction-limited": (payload: { retryInMs: number }) => void;
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
  /** A player's device is still here (every `HEARTBEAT_INTERVAL_MS`). */
  heartbeat: () => void;
  /** A player voluntarily leaves the room (back / leave-game confirmation). */
  "leave-room": () => void;
  /** A waiting player's bubble mini-game totals (about once a second). */
  "bubble-stats": (payload: BubbleStatsPayload) => void;
  /** One tap on a reaction button (rate limited server-side). */
  reaction: (payload: ReactionPayload) => void;
  /** Download progress of the next question's sound (see `preload`). */
  "preload-status": (payload: PreloadStatusPayload) => void;
  /** Progress on `preload-all`. */
  "assets-status": (payload: AssetsStatusPayload) => void;
  /** Ask for a download slot before fetching the question's sound. */
  "preload-slot": (
    payload: z.input<typeof preloadSlotSchema>,
    ack: (result: PreloadSlotAck) => void,
  ) => void;
  /** Done with a download slot (the lobby's files). */
  "slot-done": (payload: z.infer<typeof slotDoneSchema>) => void;
  /** Host: keep waiting for downloads, or open the question now. */
  "downloads-decision": (payload: DownloadsDecisionPayload) => void;
  // -- host intents (the server decides what each one means) --
  "remove-player": (player: { id: string }, gameCode?: string) => void;
  "start-game": (gameCode?: string) => void;
  "end-game-session": (gameCode?: string) => void;
}
