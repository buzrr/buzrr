import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type {
  AnswerCountPayload,
  DuelCategoryRef,
  GameOverPayload,
  AnswerResultPayload,
  GamePhase,
  LiveSummaryPayload,
  LeaderboardEntry,
  PublicQuestion,
  QuestionEndPayload,
  QuestionStartPayload,
  StateSyncPayload,
} from "@buzrr/contract";
import type { ConnectionStatus } from "@/types/socket";

/**
 * Mirror of the server-owned live game state. Every field here is pushed by
 * the server (`state-sync` on connect, then incremental events) — the client
 * never advances phases or runs authoritative timers itself.
 */
export interface GameLiveState {
  phase: GamePhase | "idle";
  mode: "classic" | "duel";
  qIndex: number;
  qCount: number;
  question: PublicQuestion | null;
  /**
   * Local-clock ms when answering closes, derived from the server's
   * `remainingMs` on receipt. Display only; 0 when no question is open.
   */
  deadline: number;
  /** Length of the current start countdown (for the progress ring). */
  countdownMs: number;
  /** Answers received for the open question (host meter). */
  answeredCount: number;
  /**
   * Host only: running results of an unscored open question
   * (`live-summary`). Best effort — the highest `answered` wins.
   */
  liveSummary: LiveSummaryPayload | null;
  reveal: QuestionEndPayload | null;
  leaderboard: LeaderboardEntry[];
  isFinalLeaderboard: boolean;
  players: {
    id: string;
    name: string;
    profilePic: string | null;
    connected: boolean;
  }[];
  you: AnswerResultPayload | null;
  /**
   * The player's place as of the latest reveal. Unlike `you` it outlives
   * `question-start`, so the next question can still show it.
   */
  standing: Standing | null;
  connection: ConnectionStatus;
  gameOver: boolean;
  /** Duels only: rating change per playerId, delivered with game-over. */
  eloChanges: Record<string, { before: number; after: number }> | null;
  /** True only for rated duels; friend invites play unrated. */
  rated: boolean;
  /** Duels only: the category played (null = Random), from game-over. */
  category: DuelCategoryRef;
  /** Duels only: daily streak per signed-in playerId, from game-over. */
  streaks: GameOverPayload["streaks"] | null;
}

export interface Standing {
  /** The question whose reveal this standing is from. */
  qIndex: number;
  rank: number;
  totalScore: number;
  /** The rank one reveal earlier, when this client saw it. */
  previousRank: number | null;
}

/** The standing after `you` for question `qIndex`, keeping the move. */
function nextStanding(
  current: Standing | null,
  qIndex: number,
  you: AnswerResultPayload,
): Standing | null {
  if (you.rank === null) return current;
  // A second result for the same reveal (a sync after the event) keeps the
  // rank it moved from.
  const previousRank =
    current?.qIndex === qIndex ? current.previousRank : (current?.rank ?? null);
  return { qIndex, rank: you.rank, totalScore: you.totalScore, previousRank };
}

const initialState: GameLiveState = {
  phase: "idle",
  mode: "classic",
  qIndex: 0,
  qCount: 0,
  question: null,
  deadline: 0,
  countdownMs: 0,
  answeredCount: 0,
  liveSummary: null,
  reveal: null,
  leaderboard: [],
  isFinalLeaderboard: false,
  players: [],
  you: null,
  standing: null,
  connection: "connecting",
  gameOver: false,
  eloChanges: null,
  rated: false,
  category: null,
  streaks: null,
};

/**
 * How far into the game a phase is. Within one game the phases only move
 * forward — lobby → starting → (question → reveal) per question → final →
 * ended — so a larger number is always a later moment.
 */
export function gameProgress(phase: GamePhase, qIndex: number): number {
  switch (phase) {
    case "lobby":
      return 0;
    case "starting":
      return 1;
    case "question":
      return 2 + qIndex * 2;
    case "reveal":
      return 3 + qIndex * 2;
    case "final":
      return Number.MAX_SAFE_INTEGER - 1;
    case "ended":
      return Number.MAX_SAFE_INTEGER;
  }
}

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    applySync: (state, action: PayloadAction<StateSyncPayload>) => {
      const s = action.payload;
      // A snapshot is read from Redis and sent once the read finishes, so a
      // phase change in between reaches the client first — e.g. the host's
      // next question, followed by a snapshot still showing the reveal.
      // Applying it would strand the player on the old screen until the next
      // event. A new socket resets the slice to "idle", so a real reconnect
      // always takes its first snapshot.
      if (
        state.phase !== "idle" &&
        gameProgress(s.phase, s.qIndex) <
          gameProgress(state.phase, state.qIndex)
      ) {
        return;
      }
      state.phase = s.phase;
      state.mode = s.mode;
      state.qIndex = s.qIndex;
      state.qCount = s.qCount;
      state.question = s.question ?? null;
      state.deadline =
        s.remainingMs === undefined ? 0 : Date.now() + s.remainingMs;
      state.countdownMs = s.phase === "starting" ? (s.remainingMs ?? 0) : 0;
      state.answeredCount = s.answeredCount ?? 0;
      // The host is sent a fresh summary right after its snapshot; keep the
      // one already held while it still belongs to the open question.
      if (s.phase !== "question" || state.liveSummary?.index !== s.qIndex) {
        state.liveSummary = null;
      }
      state.reveal = s.reveal ?? null;
      state.leaderboard = s.leaderboard ?? [];
      state.isFinalLeaderboard = s.phase === "final" || s.phase === "ended";
      state.players = s.players;
      state.you = s.you ?? null;
      // Mid-question the server sends the standing as of the last reveal —
      // none yet on the first question.
      if (s.you && (s.phase === "reveal" || s.phase === "final")) {
        state.standing = nextStanding(state.standing, s.qIndex, s.you);
      } else if (s.you && s.phase === "question" && s.qIndex > 0) {
        state.standing = nextStanding(state.standing, s.qIndex - 1, s.you);
      }
    },
    gameStarted: (state, action: PayloadAction<{ remainingMs: number }>) => {
      state.phase = "starting";
      // Display-only: the server opens question 1 on its own timer.
      state.deadline = Date.now() + action.payload.remainingMs;
      state.countdownMs = action.payload.remainingMs;
      state.gameOver = false;
    },
    questionStart: (state, action: PayloadAction<QuestionStartPayload>) => {
      const q = action.payload;
      state.phase = "question";
      state.qIndex = q.index;
      state.qCount = q.qCount;
      state.question = q.question;
      state.deadline = Date.now() + q.remainingMs;
      state.answeredCount = 0;
      state.liveSummary = null;
      state.reveal = null;
      state.you = null;
    },
    questionEnd: (state, action: PayloadAction<QuestionEndPayload>) => {
      state.phase = "reveal";
      state.reveal = action.payload;
      state.deadline = 0;
    },
    answerResult: (state, action: PayloadAction<AnswerResultPayload>) => {
      state.you = action.payload;
      state.standing = nextStanding(
        state.standing,
        state.qIndex,
        action.payload,
      );
    },
    answerCount: (state, action: PayloadAction<AnswerCountPayload>) => {
      if (action.payload.index === state.qIndex) {
        state.answeredCount = action.payload.answered;
      }
    },
    liveSummary: (state, action: PayloadAction<LiveSummaryPayload>) => {
      const live = action.payload;
      if (
        state.phase === "question" &&
        live.index === state.qIndex &&
        (state.liveSummary?.index !== live.index ||
          live.answered >= state.liveSummary.answered)
      ) {
        state.liveSummary = live;
      }
    },
    leaderboardReceived: (
      state,
      action: PayloadAction<{
        entries: LeaderboardEntry[];
        isFinal: boolean;
      }>,
    ) => {
      state.leaderboard = action.payload.entries;
      state.isFinalLeaderboard = action.payload.isFinal;
      if (action.payload.isFinal) {
        state.phase = "final";
      }
    },
    gameOver: (
      state,
      action: PayloadAction<{
        entries: LeaderboardEntry[];
        eloChanges?: Record<string, { before: number; after: number }>;
        rated?: boolean;
        category?: DuelCategoryRef;
        streaks?: GameOverPayload["streaks"];
      }>,
    ) => {
      state.phase = "ended";
      state.leaderboard = action.payload.entries;
      state.isFinalLeaderboard = true;
      state.gameOver = true;
      state.eloChanges = action.payload.eloChanges ?? null;
      state.rated = action.payload.rated ?? false;
      state.category = action.payload.category ?? null;
      state.streaks = action.payload.streaks ?? null;
    },
    playerConnection: (
      state,
      action: PayloadAction<{ playerId: string; connected: boolean }>,
    ) => {
      const p = state.players.find((x) => x.id === action.payload.playerId);
      if (p) p.connected = action.payload.connected;
    },
    /**
     * A player was kicked, banned or left. The server re-emits the leaderboard
     * on its own; this keeps the roster-derived bits (response totals, the
     * connection dots) right without waiting for the next sync.
     */
    playerRemoved: (state, action: PayloadAction<{ playerId: string }>) => {
      state.players = state.players.filter(
        (p) => p.id !== action.payload.playerId,
      );
      state.leaderboard = state.leaderboard.filter(
        (entry) => entry.playerId !== action.payload.playerId,
      );
    },
    setConnection: (state, action: PayloadAction<ConnectionStatus>) => {
      state.connection = action.payload;
    },
    resetGame: () => initialState,
  },
});

export const {
  applySync,
  gameStarted,
  questionStart,
  questionEnd,
  answerResult,
  answerCount,
  liveSummary,
  leaderboardReceived,
  gameOver,
  playerConnection,
  playerRemoved,
  setConnection,
  resetGame,
} = gameSlice.actions;

export default gameSlice.reducer;
