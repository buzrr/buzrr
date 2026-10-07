import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@buzrr/contract";

// The socket contract itself lives in `@buzrr/contract` (packages/contract) —
// one definition, imported by both this server and the web client. Only the
// server-side socket plumbing is declared here.
export type {
  AnswerCountPayload,
  AnswerResultPayload,
  ClientToServerEvents,
  DuelInviteAcceptAck,
  DuelInviteFailure,
  DuelMatchedPayload,
  GameOverPayload,
  LeaderboardPayload,
  PlayerConnectionPayload,
  QuestionEndPayload,
  QuestionStartPayload,
  ServerToClientEvents,
  StateSyncPayload,
  SubmitAnswerAck,
} from "@buzrr/contract";

export interface SocketData {
  gameCode: string;
  gameSessionId: string;
  isRoomHost: boolean;
  playerId: string | null;
  /** Set on duel-queue connections (no gameCode). */
  duelUserId?: string;
  /**
   * Set on duel-invite waiting-room connections (`intent=invite`). Doubles as
   * the presence signal that the host is sitting on the invite page.
   */
  duelInviteCode?: string;
}

export type TypedServer = import("socket.io").Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
export type TypedSocket = import("socket.io").Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
