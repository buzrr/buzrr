import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export enum HideQuestions {
  show,
  hide,
}

interface HideQuestionsState {
  visibility: HideQuestions;
}

const initialState: HideQuestionsState = {
  visibility: HideQuestions.hide,
};

const hideQuestionsSlice = createSlice({
  name: "hide questions",
  initialState,
  reducers: {
    setHideQuestions: (state, action: PayloadAction<HideQuestions>) => {
      state.visibility = action.payload;
    },
  },
});

export const { setHideQuestions } = hideQuestionsSlice.actions;

export default hideQuestionsSlice.reducer;
