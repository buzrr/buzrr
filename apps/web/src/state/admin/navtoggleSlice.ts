import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export enum NavToggle {
  expand,
  collapse,
}

interface NavToggleState {
  toggle: NavToggle;
}

const initialState: NavToggleState = {
  toggle: NavToggle.collapse,
};

const navToggleSlice = createSlice({
  name: "navToggle",
  initialState,
  reducers: {
    setNavToggle: (state, action: PayloadAction<NavToggle>) => {
      state.toggle = action.payload;
    },
  },
});

export const { setNavToggle } = navToggleSlice.actions;

export default navToggleSlice.reducer;
