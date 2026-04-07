import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export enum ResultStatus {
  correct,
  incorrect,
  timeout,
}

interface PlayerResultState {
  resultStatus: ResultStatus;
}

const initialState: PlayerResultState = {
  resultStatus: ResultStatus.timeout,
};

const resultSlice = createSlice({
  name: "result",
  initialState,
  reducers: {
    setResultStatus: (state, action: PayloadAction<ResultStatus>) => {
      state.resultStatus = action.payload;
    },
  },
});

export const { setResultStatus } = resultSlice.actions;

export default resultSlice.reducer;
