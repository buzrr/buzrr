import { createSlice } from "@reduxjs/toolkit";

interface InitialState {
  resultStatus: ResultStatus;
}

export enum ResultStatus {
  correct,
  incorrect,
  timeout,
}

const initialState: InitialState = {
  resultStatus: ResultStatus.timeout,
};

const resultSlice = createSlice({
  name: "result",
  initialState,
  reducers: {
    setResultStatus: (state, action) => {
      state.resultStatus = action.payload;
    },
  },
});

export const { setResultStatus } = resultSlice.actions;

export default resultSlice.reducer;
