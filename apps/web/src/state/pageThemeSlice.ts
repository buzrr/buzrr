import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export enum PageTheme {
  dark,
  light,
  /** Follow the device (prefers-color-scheme) until toggled by hand. */
  system,
}

interface PageThemeState {
  theme: PageTheme;
}

const initialState: PageThemeState = {
  theme: PageTheme.system,
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
