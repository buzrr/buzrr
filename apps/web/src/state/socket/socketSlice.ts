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
      return {
        ...state,
        socket: action.payload,
      };
    },
    clearConnection: (state) => {
      return {
        ...state,
        socket: null,
      };
    },
  },
});

export default socketSlice.reducer;
export const { createConnection, clearConnection } = socketSlice.actions;
