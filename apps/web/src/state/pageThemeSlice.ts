import { createSlice } from "@reduxjs/toolkit";

interface InitialState {
  theme: pageTheme;
}

export enum pageTheme {
  dark,
  light,
}

const initialState: InitialState = {
  theme: pageTheme.light,
};

const pageThemeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    setpageTheme: (state, action) => {
      state.theme = action.payload;
    },
  },
});

export const { setpageTheme } = pageThemeSlice.actions;

export default pageThemeSlice.reducer;
