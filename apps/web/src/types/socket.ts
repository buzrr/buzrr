import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@buzrr/contract";

// The socket contract (event names and payloads) is `@buzrr/contract`, shared
// with the server — import payload types from there. Only client-side socket
// plumbing lives here.

export type GameSocket = import("socket.io-client").Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";
