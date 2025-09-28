import { createSlice } from "@reduxjs/toolkit";

interface InitialState {
  players: any[];
  quesResult: number[];
  currentIndex: number;
  leaderboard: any[];
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
    addPlayer: (state, action) => {
      const existingPlayer = state.players.find(
        (player: any) => player.id === action.payload.id,
      );
      if (existingPlayer) {
        return;
      }
      state.players = [...state.players, action.payload];
    },
    removePlayer: (state, action) => {
      state.players = state.players.filter(
        (player) => player.id !== action.payload.id,
      );
    },
    setPlayers: (state, action) => {
      state.players = action.payload;
    },
    setResult: (state, action) => {
      state.quesResult = action.payload;
    },
    setCurrIndex: (state, action) => {
      state.currentIndex = action.payload;
    },
    setLeaderboard: (state, action) => {
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
