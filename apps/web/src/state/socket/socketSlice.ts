import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Socket } from "socket.io-client";

interface SocketState {
  socket: Socket | null;
}

const initialState: SocketState = {
  socket: null,
};

const socketSlice = createSlice({
  name: "socket",
  initialState,
  reducers: {
    createConnection: (state, action: PayloadAction<Socket>) => {
      state.socket = action.payload;
    },
  },
});

export default socketSlice.reducer;
export const { createConnection } = socketSlice.actions;
