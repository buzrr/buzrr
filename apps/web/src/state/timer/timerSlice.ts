import { createSlice } from "@reduxjs/toolkit";

interface CounterState {
  value: number;
}

const initialState: CounterState = {
  value: 3,
};

const timerSlice = createSlice({
  name: "timer",
  initialState,
  reducers: {
    setTimer: (state) => {
      state.value = state.value - 1;
    },
    resetTimer: (state, action) => {
      state.value = action.payload;
    },
  },
});

export const { setTimer, resetTimer } = timerSlice.actions;

export default timerSlice.reducer;
