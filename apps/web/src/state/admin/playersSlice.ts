import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface Player {
  id: string;
  name?: string;
  profilePic?: string;
  [key: string]: unknown;
}

interface LeaderboardEntry {
  Player?: { name?: string; profilePic?: string };
  score?: number;
  playerId?: string;
  position?: number;
  [key: string]: unknown;
}

interface InitialState {
  players: Player[];
  quesResult: number[];
  currentIndex: number;
  leaderboard: LeaderboardEntry[];
}

const initialState: InitialState = {
  players: [],
  quesResult: [],
  currentIndex: 0,
  leaderboard: [],
};

const playerSlice = createSlice({
  name: "player",
  initialState,
  reducers: {
    addPlayer: (state, action: PayloadAction<Player>) => {
      const existingPlayer = state.players.find(
        (player) => player.id === action.payload.id,
      );
      if (existingPlayer) {
        return;
      }
      state.players = [...state.players, action.payload];
    },
    removePlayer: (state, action: PayloadAction<Player>) => {
      state.players = state.players.filter(
        (player) => player.id !== action.payload.id,
      );
    },
    setPlayers: (state, action: PayloadAction<Player[]>) => {
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
