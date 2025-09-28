import { createSlice } from "@reduxjs/toolkit";

interface InitialState {
  view: string;
}

const initialState: InitialState = {
  view: "grid",
};

const gridListToggleSlice = createSlice({
  name: "gridListToggle",
  initialState,
  reducers: {
    setGridListToggle: (state, action) => {
      state.view = action.payload;
    },
  },
});

export const { setGridListToggle } = gridListToggleSlice.actions;

export default gridListToggleSlice.reducer;
