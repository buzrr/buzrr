import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export enum ScreenStatus {
  question,
  result,
  wait,
  lobby,
  leaderboard,
}

interface PlayerScreenState {
  screenStatus: ScreenStatus;
}

const initialState: PlayerScreenState = {
  screenStatus: ScreenStatus.lobby,
};

const screenSlice = createSlice({
  name: "screen",
  initialState,
  reducers: {
    setScreenStatus: (state, action: PayloadAction<ScreenStatus>) => {
      state.screenStatus = action.payload;
    },
  },
});

export const { setScreenStatus } = screenSlice.actions;

export default screenSlice.reducer;
