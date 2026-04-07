import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export enum PageTheme {
  dark,
  light,
}

interface PageThemeState {
  theme: PageTheme;
}

const initialState: PageThemeState = {
  theme: PageTheme.light,
};

const pageThemeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    setPageTheme: (state, action: PayloadAction<PageTheme>) => {
      state.theme = action.payload;
    },
  },
});

export const { setPageTheme } = pageThemeSlice.actions;

export default pageThemeSlice.reducer;
