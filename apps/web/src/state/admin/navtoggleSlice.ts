import { createSlice } from "@reduxjs/toolkit";

interface InitialState {
  toggle: navToggle;
}

export enum navToggle {
  expand,
  collapse,
}

const initialState: InitialState = {
  toggle: navToggle.collapse,
};

const navToggleSlice = createSlice({
  name: "navToggle",
  initialState,
  reducers: {
    setNavToggle: (state, action) => {
      state.toggle = action.payload;
    },
  },
});

export const { setNavToggle } = navToggleSlice.actions;

export default navToggleSlice.reducer;
