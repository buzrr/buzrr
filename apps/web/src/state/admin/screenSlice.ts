import { createSlice } from "@reduxjs/toolkit";

interface InitialState {
  screenStatus: ScreenStatus;
}

export enum ScreenStatus {
  question,
  result,
  wait,
  leaderboard,
  lobby,
}

const initialState: InitialState = {
  screenStatus: ScreenStatus.lobby,
};

const screenSlice = createSlice({
  name: "adminScreen",
  initialState,
  reducers: {
    setScreenStatus: (state, action) => {
      state.screenStatus = action.payload;
    },
  },
});

export const { setScreenStatus } = screenSlice.actions;

export default screenSlice.reducer;
