import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { parseCorsOrigin } from "../../common/utils/parse-cors-origin";
import { MatchmakingService } from "../duel/matchmaking.service";
import { GameEngineService } from "../game-engine/game-engine.service";
import { GameStoreService } from "../game-engine/game-store.service";
import { RealtimeService } from "./realtime.service";
import type { TypedServer, TypedSocket } from "./realtime.types";

@WebSocketGateway({
  cors: {
    origin: parseCorsOrigin(process.env.WEB_ORIGIN),
    credentials: true,
    allowedHeaders: ["*"],
  },
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
  ) {}

  afterInit(server: TypedServer): void {
    this.engine.setServer(server);
    this.matchmaking.setServer(server);
  }

  async handleConnection(socket: TypedSocket): Promise<void> {
    this.logger.log(`New connection: ${socket.id}`);

    try {
      const result = await this.realtimeService.validateConnection(socket);

      if (!result.valid) {
        this.logger.log(`${result.reason} — Disconnecting: ${socket.id}`);
        socket.disconnect();
        return;
      }

      if (result.userType === "duel") {
        await this.handleDuelConnection(socket, result.user, result.gameCode);
        return;
      }

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
        await socket.join(`player:${player.id}`);
        await this.engine.playerConnected(gameCode, {
          id: player.id,
          name: player.name,
          profilePic: player.profilePic,
        });
        this.server.to(gameCode).emit("player-joined", player);
      }

      if (isRoomHost) {
        await this.engine.hostConnected(gameCode, true);
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
   * Duel connections come in two flavors: queue (no gameCode — the player is
   * waiting for a match) and game (the Redis-only duel room).
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
  ): Promise<void> {
    await socket.join(`player:${user.id}`);

    if (!gameCode) {
      socket.data = {
        gameCode: "",
        gameSessionId: "",
        isRoomHost: false,
        playerId: null,
        duelUserId: user.id,
      };
      this.logger.log(`Duel queue connection: ${user.id}`);

      const enqueue = async () => {
        try {
          await this.matchmaking.enqueue({
            id: user.id,
            name: user.name ?? "Player",
            image: user.image,
            elo: user.eloRating,
          });
        } catch (error) {
          this.logger.error("Error joining duel queue:", error);
          socket.emit("duel:error", { message: "Could not join the queue" });
        }
      };

      socket.on("duel:queue", () => void enqueue());
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
        await this.engine.hostConnected(data.gameCode, false);
        this.logger.log(`Host left game ${data.gameCode}`);
      } else if (data.playerId) {
        await this.engine.playerDisconnected(data.gameCode, data.playerId);
        this.logger.log(
          `Player ${data.playerId} disconnected from ${data.gameCode}`,
        );
      }
    } catch (err) {
      this.logger.error("Error handling disconnect:", err);
    }
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

    // Legacy v1 host events, accepted as pacing aliases until the web client
    // is fully migrated. The server ignores every client-supplied index/id —
    // it alone decides what comes next.
    const legacyNext = () => {
      void this.engine
        .hostNext(gameCode)
        .catch((error) => this.logger.error("Error advancing game:", error));
    };
    socket.on("start-timer", () => {
      // No-op: the server starts timing when it enters the question phase.
    });
    socket.on("set-question-index", legacyNext);
    socket.on("change-question", legacyNext);
    socket.on("display-result", legacyNext);
    socket.on("final-leaderboard", legacyNext);
    socket.on("display-leaderboard", () => {
      // No-op: leaderboards are pushed by the engine.
    });
  }

  private registerPlayerHandlers(socket: TypedSocket, gameCode: string): void {
    socket.on("submit-answer", async (payload, ack) => {
      try {
        const playerId = socket.data.playerId;
        if (!playerId) {
          ack?.({ accepted: false, reason: "Not a player connection" });
          return;
        }
        if (
          !payload ||
          typeof payload.qIndex !== "number" ||
          typeof payload.optionId !== "string"
        ) {
          ack?.({ accepted: false, reason: "Malformed payload" });
          return;
        }
        const result = await this.engine.submitAnswer(
          gameCode,
          playerId,
          payload.qIndex,
          payload.optionId,
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
        socket.emit("state-sync", snapshot);
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
