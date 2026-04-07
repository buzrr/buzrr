import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { PlayerPayload, LeaderboardEntry } from "@/types/socket-events";

interface PlayersState {
  players: PlayerPayload[];
  quesResult: number[];
  currentIndex: number;
  leaderboard: LeaderboardEntry[];
}

const initialState: PlayersState = {
  players: [],
  quesResult: [],
  currentIndex: 0,
  leaderboard: [],
};

const playerSlice = createSlice({
  name: "player",
  initialState,
  reducers: {
    addPlayer: (state, action: PayloadAction<PlayerPayload>) => {
      const exists = state.players.some((p) => p.id === action.payload.id);
      if (!exists) {
        state.players.push(action.payload);
      }
    },
    removePlayer: (state, action: PayloadAction<{ id: string }>) => {
      state.players = state.players.filter(
        (player) => player.id !== action.payload.id,
      );
    },
    setPlayers: (state, action: PayloadAction<PlayerPayload[]>) => {
      state.players = action.payload;
    },
    setResult: (state, action: PayloadAction<number[]>) => {
      state.quesResult = action.payload;
    },
    setCurrIndex: (state, action: PayloadAction<number>) => {
      state.currentIndex = action.payload;
    },
    setLeaderboard: (state, action: PayloadAction<LeaderboardEntry[]>) => {
      state.leaderboard = action.payload;
    },
  },
});

export const {
  addPlayer,
  removePlayer,
  setPlayers,
  setResult,
  setCurrIndex,
  setLeaderboard,
} = playerSlice.actions;

export default playerSlice.reducer;
