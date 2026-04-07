import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface TimerState {
  value: number;
}

const initialState: TimerState = {
  value: 3,
};

const timerSlice = createSlice({
  name: "timer",
  initialState,
  reducers: {
    setTimer: (state) => {
      state.value = Math.max(0, state.value - 1);
    },
    resetTimer: (state, action: PayloadAction<number>) => {
      state.value = Math.max(0, action.payload);
    },
  },
});

export const { setTimer, resetTimer } = timerSlice.actions;

export default timerSlice.reducer;
