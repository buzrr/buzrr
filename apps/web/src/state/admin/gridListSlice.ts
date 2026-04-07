import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type ViewMode = "grid" | "list";

interface GridListState {
  view: ViewMode;
}

const initialState: GridListState = {
  view: "grid",
};

const gridListToggleSlice = createSlice({
  name: "gridListToggle",
  initialState,
  reducers: {
    setGridListToggle: (state, action: PayloadAction<ViewMode>) => {
      state.view = action.payload;
    },
  },
});

export const { setGridListToggle } = gridListToggleSlice.actions;

export default gridListToggleSlice.reducer;
