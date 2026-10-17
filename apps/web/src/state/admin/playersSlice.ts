import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { PlayerPayload } from "@buzrr/contract";

/**
 * Host-screen roster. Live gameplay state (phase, question, leaderboard) is
 * server-owned and lives in `gameSlice` — never mirror it here.
 */
interface PlayersState {
  players: PlayerPayload[];
}

const initialState: PlayersState = {
  players: [],
};

const playerSlice = createSlice({
  name: "player",
  initialState,
  reducers: {
    addPlayer: (state, action: PayloadAction<PlayerPayload>) => {
      // Upsert: a player who switches avatar in the lobby is announced again.
      const i = state.players.findIndex((p) => p.id === action.payload.id);
      if (i === -1) state.players.push(action.payload);
      else state.players[i] = action.payload;
    },
    removePlayer: (state, action: PayloadAction<{ id: string }>) => {
      state.players = state.players.filter(
        (player) => player.id !== action.payload.id,
      );
    },
    setPlayers: (state, action: PayloadAction<PlayerPayload[]>) => {
      state.players = action.payload;
    },
  },
});

export const { addPlayer, removePlayer, setPlayers } = playerSlice.actions;

export default playerSlice.reducer;
