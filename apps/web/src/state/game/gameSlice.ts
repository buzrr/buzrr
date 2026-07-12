import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type {
  AnswerResultPayload,
  ConnectionStatus,
  GamePhase,
  LiveLeaderboardEntry,
  PublicQuestion,
  QuestionEndPayload,
  QuestionStartPayload,
  StateSyncPayload,
} from "@/types/socket-events";

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
  startAt: number;
  deadline: number;
  /** serverNow - clientNow at last sync; add to Date.now() to get server time. */
  clockOffset: number;
  reveal: QuestionEndPayload | null;
  leaderboard: LiveLeaderboardEntry[];
  isFinalLeaderboard: boolean;
  players: {
    id: string;
    name: string;
    profilePic: string | null;
    connected: boolean;
  }[];
  you: AnswerResultPayload | null;
  connection: ConnectionStatus;
  gameOver: boolean;
  /** Duels only: rating change per playerId, delivered with game-over. */
  eloChanges: Record<string, { before: number; after: number }> | null;
}

const initialState: GameLiveState = {
  phase: "idle",
  mode: "classic",
  qIndex: 0,
  qCount: 0,
  question: null,
  startAt: 0,
  deadline: 0,
  clockOffset: 0,
  reveal: null,
  leaderboard: [],
  isFinalLeaderboard: false,
  players: [],
  you: null,
  connection: "connecting",
  gameOver: false,
  eloChanges: null,
};

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    applySync: (state, action: PayloadAction<StateSyncPayload>) => {
      const s = action.payload;
      state.phase = s.phase;
      state.mode = s.mode;
      state.qIndex = s.qIndex;
      state.qCount = s.qCount;
      state.clockOffset = s.serverNow - Date.now();
      state.question = s.question ?? null;
      state.startAt = s.startAt ?? 0;
      state.deadline = s.deadline ?? 0;
      state.reveal = s.reveal ?? null;
      state.leaderboard = s.leaderboard ?? [];
      state.isFinalLeaderboard = s.phase === "final" || s.phase === "ended";
      state.players = s.players;
      state.you = s.you ?? null;
    },
    gameStarted: (state) => {
      state.phase = "starting";
      state.gameOver = false;
    },
    questionStart: (state, action: PayloadAction<QuestionStartPayload>) => {
      const q = action.payload;
      state.phase = "question";
      state.qIndex = q.index;
      state.qCount = q.qCount;
      state.question = q.question;
      state.startAt = q.startAt;
      state.deadline = q.deadline;
      state.clockOffset = q.serverNow - Date.now();
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
    },
    leaderboardReceived: (
      state,
      action: PayloadAction<{
        entries: LiveLeaderboardEntry[];
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
        entries: LiveLeaderboardEntry[];
        eloChanges?: Record<string, { before: number; after: number }>;
      }>,
    ) => {
      state.phase = "ended";
      state.leaderboard = action.payload.entries;
      state.isFinalLeaderboard = true;
      state.gameOver = true;
      state.eloChanges = action.payload.eloChanges ?? null;
    },
    playerConnection: (
      state,
      action: PayloadAction<{ playerId: string; connected: boolean }>,
    ) => {
      const p = state.players.find((x) => x.id === action.payload.playerId);
      if (p) p.connected = action.payload.connected;
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
  leaderboardReceived,
  gameOver,
  playerConnection,
  setConnection,
  resetGame,
} = gameSlice.actions;

export default gameSlice.reducer;
