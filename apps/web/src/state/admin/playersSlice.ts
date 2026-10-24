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
      const exists = state.players.some((p) => p.id === action.payload.id);
      if (!exists) {
        state.players.push(action.payload);
      }
    },
    /** Many joins at once, applied in one go. */
    addPlayers: (state, action: PayloadAction<PlayerPayload[]>) => {
      const index = new Map(state.players.map((p, i) => [p.id, i]));
      for (const p of action.payload) {
        const i = index.get(p.id);
        if (i === undefined) {
          index.set(p.id, state.players.length);
          state.players.push(p);
        } else state.players[i] = p;
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
  },
});

export const { addPlayer, addPlayers, removePlayer, setPlayers } =
  playerSlice.actions;

export default playerSlice.reducer;
