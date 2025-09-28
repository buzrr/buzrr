import { createSlice } from "@reduxjs/toolkit";
import { Socket } from "socket.io-client";

interface SocketState {
  socket: Socket;
}

const initialState: SocketState = {
  socket: {} as Socket,
};

const socketSlice = createSlice({
  name: "socket",
  initialState,
  reducers: {
    createConnection: (state, actions) => {
      state.socket = actions.payload;
    },
  },
});

export default socketSlice.reducer;
export const { createConnection } = socketSlice.actions;
