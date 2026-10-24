import { signAssetsDeep } from "../../common/storage/asset-signing";
import {
  HEARTBEAT_TIMEOUT_MS,
  duelQueueSchema,
  submitAnswerSchema,
} from "@buzrr/contract";
import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { parseCorsOrigin } from "../../common/utils/parse-cors-origin";
import { DuelInviteService } from "../duel/duel-invite.service";
import { MatchmakingService } from "../duel/matchmaking.service";
import { GameEngineService } from "../game-engine/game-engine.service";
import { GameStoreService } from "../game-engine/game-store.service";
import { RealtimeService } from "./realtime.service";
import type {
  DuelInviteAcceptAck,
  TypedServer,
  TypedSocket,
} from "./realtime.types";

type DuelInviteAck = (result: DuelInviteAcceptAck) => void;

/** How often a player socket's heartbeat is checked. */
const HEARTBEAT_CHECK_MS = 5_000;
/** A disconnected lobby player keeps their place at least this long. */
const REJOIN_GRACE_MS = 10_000;

@WebSocketGateway({
  cors: {
    origin: parseCorsOrigin(process.env.WEB_ORIGIN),
    credentials: true,
    allowedHeaders: ["*"],
  },
  // A dead transport is noticed within pingInterval + pingTimeout (20s; the
  // Socket.IO default is 45s). Until then the server keeps the dead socket —
  // the player misses events and the client doesn't know to reconnect.
  // Not much tighter: a short pingTimeout drops players on slow mobile links.
  pingInterval: 10_000,
  pingTimeout: 10_000,
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: TypedServer;

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly engine: GameEngineService,
    private readonly store: GameStoreService,
    private readonly matchmaking: MatchmakingService,
    private readonly invites: DuelInviteService,
  ) {}

  afterInit(server: TypedServer): void {
    this.engine.setServer(server);
    this.matchmaking.setServer(server);
    this.invites.setServer(server);
  }

  async handleConnection(socket: TypedSocket): Promise<void> {
    this.logger.log(`New connection: ${socket.id}`);

    // socket.io drops events with no listener, and validateConnection below
    // costs a DB round trip — so buffer accepts that beat it, or a guest who
    // clicks Accept the instant the page connects never gets an ack.
    const buffered: DuelInviteAck[] = [];
    const bufferAccept = (_payload: { code: string }, ack: DuelInviteAck) =>
      buffered.push(ack);
    socket.on("duel:invite-accept", bufferAccept);

    try {
      const result = await this.realtimeService.validateConnection(socket);

      if (!result.valid) {
        this.logger.log(`${result.reason} — Disconnecting: ${socket.id}`);
        buffered.forEach((ack) => ack({ ok: false, reason: "error" }));
        socket.disconnect();
        return;
      }

      if (result.userType === "duel") {
        await this.handleDuelConnection(
          socket,
          result.user,
          result.gameCode,
          result.intent,
          { buffered, bufferAccept },
          result.categoryId,
        );
        return;
      }

      socket.off("duel:invite-accept", bufferAccept);
      buffered.forEach((ack) => ack({ ok: false, reason: "error" }));

      const { gameCode, gameSessionId, isRoomHost, player, userType } = result;

      socket.data = {
        gameCode,
        gameSessionId,
        isRoomHost,
        playerId: player?.id ?? null,
      };

      await socket.join(gameCode);
      await this.engine.ensureLiveSession(gameCode, {
        sessionId: gameSessionId,
        quizId: result.quizId,
        hostId: result.hostId,
      });

      this.logger.log(
        `${userType === "player" ? `Player: ${player?.id}` : `Admin`} SocketId: ${socket.id} joined Game: ${gameCode}`,
      );

      if (userType === "player" && player) {
        // Join the per-player room *before* registering: a ban landing after
        // this point reaches this socket via disconnectSockets, and one
        // landing before it is caught by the roster write below. Banned
        // players are refused even holding a valid token and a Postgres row
        // still pointing at this room (e.g. a rejoin racing the kick).
        await socket.join(`player:${player.id}`);
        const admitted = await this.engine.playerConnected(gameCode, {
          id: player.id,
          name: player.name,
          profilePic: player.profilePic,
        });
        if (!admitted) {
          this.logger.log(
            `Player ${player.id} is banned from ${gameCode} — disconnecting`,
          );
          socket.disconnect();
          return;
        }
        this.server.to(gameCode).emit("player-joined", player);
        this.watchHeartbeat(socket, gameCode);
      }

      if (isRoomHost) {
        // Lets a host disconnect tell a stale socket from the host leaving
        // (see GameEngineService.hostDisconnected).
        await socket.join(`host:${gameCode}`);
        await this.engine.hostConnected(gameCode);
        this.registerHostHandlers(socket, gameCode);
      } else {
        this.registerPlayerHandlers(socket, gameCode);
      }

      socket.on("request-sync", () => {
        void this.sendSnapshot(socket);
      });

      // Bring late joiners and reconnecting clients up to date immediately.
      await this.sendSnapshot(socket);
    } catch (err) {
      this.handleConnectionError(err, socket);
    }
  }

  /**
   * Duel connections come in three flavors: queue (no gameCode — the player is
   * waiting for an ELO match), invite (a friend-challenge waiting room, where
   * the gameCode is a reserved invite code with no live game behind it yet),
   * and game (the Redis-only duel room).
   */
  private async handleDuelConnection(
    socket: TypedSocket,
    user: {
      id: string;
      name: string | null;
      image: string | null;
      eloRating: number;
    },
    gameCode: string,
    intent: "queue" | "invite",
    earlyAccepts: {
      buffered: DuelInviteAck[];
      bufferAccept: (payload: { code: string }, ack: DuelInviteAck) => void;
    },
    queueCategoryId: string | null,
  ): Promise<void> {
    await socket.join(`player:${user.id}`);
    socket.off("duel:invite-accept", earlyAccepts.bufferAccept);

    if (intent === "invite") {
      // Must not fall through to the queue branch below, which would silently
      // drop a codeless invite connection into *ranked* matchmaking.
      if (!gameCode) {
        this.logger.log(
          `Invite connection without a code from ${user.id} — disconnecting`,
        );
        earlyAccepts.buffered.forEach((ack) =>
          ack({ ok: false, reason: "not-found" }),
        );
        socket.disconnect();
        return;
      }

      // No live room exists yet, so skip the roster gate, engine and snapshot.
      // `playerId` null and `duelUserId` unset keep handleDisconnect a no-op:
      // the invite outlives the socket (reload, remount, backgrounding), and
      // staleness is caught by the presence check at accept time instead.
      socket.data = {
        gameCode,
        gameSessionId: "",
        isRoomHost: false,
        playerId: null,
        duelInviteCode: gameCode,
      };
      this.logger.log(`Duel invite connection: ${user.id} on ${gameCode}`);

      // The handshake code wins over the payload — it's what host presence is
      // keyed on, so any other code would check a room this socket isn't in.
      const acceptInvite = (ack: DuelInviteAck) => {
        void this.invites
          .accept(gameCode, {
            id: user.id,
            name: user.name ?? "Player",
            image: user.image,
            elo: user.eloRating,
          })
          .then(ack)
          .catch((error) => {
            this.logger.error("Error accepting duel invite:", error);
            ack({ ok: false, reason: "error" });
          });
      };

      socket.on("duel:invite-accept", (_payload, ack) => acceptInvite(ack));
      earlyAccepts.buffered.forEach(acceptInvite);
      return;
    }

    // Queue and game connections never accept invites.
    earlyAccepts.buffered.forEach((ack) => ack({ ok: false, reason: "error" }));

    if (!gameCode) {
      socket.data = {
        gameCode: "",
        gameSessionId: "",
        isRoomHost: false,
        playerId: null,
        duelUserId: user.id,
      };
      this.logger.log(`Duel queue connection: ${user.id}`);

      // The handshake picks the first search's category; a later
      // `duel:queue { categoryId }` switches it (e.g. to Random).
      let categoryId = queueCategoryId;
      const enqueue = async () => {
        try {
          await this.matchmaking.enqueue(
            {
              id: user.id,
              name: user.name ?? "Player",
              image: user.image,
              elo: user.eloRating,
            },
            categoryId,
          );
        } catch (error) {
          this.logger.error("Error joining duel queue:", error);
          socket.emit("duel:error", { message: "Could not join the queue" });
        }
      };

      socket.on("duel:queue", (payload) => {
        const parsed = duelQueueSchema.safeParse(payload);
        if (parsed.success && parsed.data?.categoryId !== undefined) {
          categoryId = parsed.data.categoryId;
        }
        void enqueue();
      });
      // Enqueue server-side too: the client emits duel:queue on connect,
      // which can arrive while validateConnection is still running — before
      // this handler exists — and socket.io drops events with no listener.
      await enqueue();
      socket.on("duel:cancel", () => {
        void this.matchmaking
          .dequeue(user.id)
          .catch((error) =>
            this.logger.error("Error leaving duel queue:", error),
          );
      });
      return;
    }

    // Duel game connection — only the two matched players may join.
    const entry = await this.store.getPlayer(gameCode, user.id);
    if (!entry) {
      this.logger.log(
        `User ${user.id} is not part of duel ${gameCode} — disconnecting`,
      );
      socket.disconnect();
      return;
    }

    socket.data = {
      gameCode,
      gameSessionId: "",
      isRoomHost: false,
      playerId: user.id,
    };
    await socket.join(gameCode);
    await this.engine.playerConnected(gameCode, {
      id: user.id,
      name: entry.name,
      profilePic: entry.profilePic,
    });
    this.registerPlayerHandlers(socket, gameCode);
    socket.on("request-sync", () => {
      void this.sendSnapshot(socket);
    });
    await this.sendSnapshot(socket);
    this.logger.log(`User ${user.id} joined duel ${gameCode}`);
  }

  async handleDisconnect(socket: TypedSocket): Promise<void> {
    const data = socket.data;
    if (data?.duelUserId) {
      await this.matchmaking
        .dequeue(data.duelUserId)
        .catch((err) =>
          this.logger.error("Error dequeuing on disconnect", err),
        );
      return;
    }
    if (!data?.gameCode) return;
    try {
      if (data.isRoomHost) {
        await this.engine.hostDisconnected(data.gameCode);
        this.logger.log(`Host left game ${data.gameCode}`);
      } else if (data.playerId) {
        // A lobby player leaves the list three missed beats after their last
        // one — but never sooner than a page reload takes to come back.
        const graceMs = data.lastBeatAt
          ? Math.max(
              REJOIN_GRACE_MS,
              data.lastBeatAt + HEARTBEAT_TIMEOUT_MS - Date.now(),
            )
          : undefined;
        await this.engine.playerDisconnected(
          data.gameCode,
          data.playerId,
          graceMs,
        );
        this.logger.log(
          `Player ${data.playerId} disconnected from ${data.gameCode}`,
        );
      }
    } catch (err) {
      this.logger.error("Error handling disconnect:", err);
    }
  }

  /**
   * Players' devices beat every `HEARTBEAT_INTERVAL_MS`. A socket that has
   * beaten once and then misses three beats (`HEARTBEAT_TIMEOUT_MS`) is
   * dropped — the transport's own ping can't tell a frozen page from a live
   * one — and the player shows as offline. Clients too old to beat are left
   * to that ping. The last beat also sets how long a lobby player keeps
   * their place once gone (see handleDisconnect).
   */
  private watchHeartbeat(socket: TypedSocket, gameCode: string) {
    socket.on("heartbeat", () => {
      socket.data.lastBeatAt = Date.now();
    });
    // A socket that never beats counts from its connect: a client that keeps
    // reconnecting without beating (stuck, or long-outdated) would otherwise
    // stay "online" forever — counted in "x of y answered" and waited for.
    const since = Date.now();
    const check = setInterval(() => {
      const last = socket.data.lastBeatAt ?? since;
      if (Date.now() - last < HEARTBEAT_TIMEOUT_MS) return;
      clearInterval(check);
      this.logger.log(
        `Player ${socket.data.playerId} missed heartbeats in ${gameCode} — dropping the socket`,
      );
      // Close the transport, not the socket: a page that wakes up again
      // reconnects on its own ("transport close"), where a server-side
      // socket disconnect would read as refused and never retry.
      socket.conn.close();
    }, HEARTBEAT_CHECK_MS);
    socket.once("disconnect", () => clearInterval(check));
  }

  private registerHostHandlers(socket: TypedSocket, gameCode: string): void {
    socket.on("remove-player", async (p: { id: string }) => {
      try {
        const removed = await this.realtimeService.removePlayer(
          p.id,
          socket.data.gameSessionId,
        );
        if (removed) {
          await this.engine.kickPlayer(gameCode, p);
          this.logger.log(`Player ${p.id} removed from ${gameCode}`);
        } else {
          // Already detached in Postgres (e.g. a partially-failed earlier
          // kick) — still clear any stale Redis roster entry, quietly.
          await this.engine.removePlayer(gameCode, p.id);
        }
      } catch (error) {
        this.logger.error("Error removing player:", error);
      }
    });

    socket.on("start-game", async () => {
      try {
        await this.engine.startGame(gameCode);
      } catch (error) {
        this.logger.error("Error starting game:", error);
      }
    });

    socket.on("host-next", async () => {
      try {
        await this.engine.hostNext(gameCode);
      } catch (error) {
        this.logger.error("Error advancing game:", error);
      }
    });

    socket.on("end-game-session", async () => {
      try {
        await this.engine.endGame(gameCode);
      } catch (error) {
        this.logger.error("Error ending game session:", error);
      }
    });
  }

  private registerPlayerHandlers(socket: TypedSocket, gameCode: string): void {
    socket.on("leave-room", async () => {
      const playerId = socket.data.playerId;
      if (!playerId) return;
      try {
        await this.realtimeService.removePlayer(
          playerId,
          socket.data.gameSessionId,
        );
        await this.engine.removePlayer(gameCode, playerId);
        // Notify the host (and everyone else) so their roster updates
        // immediately — but not the leaving player, whose client is
        // navigating away and must keep its saved session. `player-left` is
        // distinct from `player-removed` (a host kick) so the host doesn't get
        // a "you removed this player" toast for a voluntary leave.
        socket.to(gameCode).emit("player-left", { id: playerId });
        this.logger.log(`Player ${playerId} left game ${gameCode}`);
      } catch (error) {
        this.logger.error("Error handling player leave:", error);
      }
    });

    socket.on("submit-answer", async (payload, ack) => {
      try {
        const playerId = socket.data.playerId;
        if (!playerId) {
          ack?.({ accepted: false, reason: "Not a player connection" });
          return;
        }
        // The contract's shape check; the question's own type then decides
        // whether the answer fits the question being asked.
        const parsed = submitAnswerSchema.safeParse(payload);
        if (!parsed.success) {
          ack?.({ accepted: false, reason: "Malformed payload" });
          return;
        }
        const result = await this.engine.submitAnswer(
          gameCode,
          playerId,
          parsed.data.qIndex,
          parsed.data.answer,
        );
        ack?.(result);
      } catch (error) {
        this.logger.error("Error submitting answer:", error);
        ack?.({ accepted: false, reason: "Internal error" });
      }
    });
  }

  private async sendSnapshot(socket: TypedSocket): Promise<void> {
    try {
      const snapshot = await this.engine.getSnapshot(
        socket.data.gameCode,
        socket.data.playerId,
      );
      if (snapshot) {
        // A (re)connecting member of the room gets the open question's media.
        socket.emit("state-sync", signAssetsDeep(snapshot));
        // A (re)connecting host gets the running results right away rather
        // than on the next answer.
        if (socket.data.isRoomHost && snapshot.phase === "question") {
          await this.engine.sendLiveSummary(socket.data.gameCode);
        }
      }
    } catch (error) {
      this.logger.error("Error sending state snapshot:", error);
    }
  }

  private handleConnectionError(err: unknown, socket: TypedSocket) {
    const code =
      err && typeof err === "object" && "code" in err
        ? (err as { code: string }).code
        : "";

    if (code === "ECONNREFUSED" || code === "P1001") {
      this.logger.error(
        `Database unavailable. Disconnecting socket: ${socket.id}`,
        err instanceof Error ? err.message : err,
      );
    } else {
      this.logger.error("Error during socket connection:", err);
    }

    socket.disconnect();
  }
}
