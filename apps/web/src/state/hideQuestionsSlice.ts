import { createSlice } from "@reduxjs/toolkit";

interface InitialState {
  visibility: hideQuestions;
}

export enum hideQuestions {
  show,
  hide,
}

const initialState: InitialState = {
  visibility: hideQuestions.hide,
};

const hideQuestionsSlice = createSlice({
  name: "hide questions",
  initialState,
  reducers: {
    setHideQuestions: (state, action) => {
      state.visibility = action.payload;
    },
  },
});

export const { setHideQuestions } = hideQuestionsSlice.actions;

export default hideQuestionsSlice.reducer;
