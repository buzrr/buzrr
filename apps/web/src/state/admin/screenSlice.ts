import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export enum ScreenStatus {
  question,
  result,
  wait,
  leaderboard,
  lobby,
}

interface AdminScreenState {
  screenStatus: ScreenStatus;
}

const initialState: AdminScreenState = {
  screenStatus: ScreenStatus.lobby,
};

const screenSlice = createSlice({
  name: "adminScreen",
  initialState,
  reducers: {
    setScreenStatus: (state, action: PayloadAction<ScreenStatus>) => {
      state.screenStatus = action.payload;
    },
  },
});

export const { setScreenStatus } = screenSlice.actions;

export default screenSlice.reducer;
