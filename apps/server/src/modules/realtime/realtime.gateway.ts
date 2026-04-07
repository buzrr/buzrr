import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { parseCorsOrigin } from "../../common/utils/parse-cors-origin";
import { RealtimeService } from "./realtime.service";

@WebSocketGateway({
  cors: {
    origin: parseCorsOrigin(process.env.WEB_ORIGIN),
    credentials: true,
    allowedHeaders: ["*"],
  },
})
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly realtimeService: RealtimeService) {}

  async handleConnection(socket: Socket): Promise<void> {
    const io = this.server;
    this.logger.log(`New connection: ${socket.id}`);

    try {
      const result = await this.realtimeService.validateConnection(socket);

      if (!result.valid) {
        this.logger.log(`${result.reason} — Disconnecting: ${socket.id}`);
        socket.disconnect();
        return;
      }

      const { gameCode, gameSessionId, isRoomHost, player, userType } = result;

      await socket.join(gameCode);

      this.logger.log(
        `${userType === "player" ? `Player: ${player?.id}` : `Admin`} SocketId: ${socket.id} joined Game: ${gameCode}`,
      );

      if (userType === "player" && player) {
        io.to(gameCode).emit("player-joined", player);
      }

      if (!isRoomHost) return;

      this.registerHostHandlers(socket, io, gameCode, gameSessionId);
    } catch (err) {
      this.handleConnectionError(err, socket);
    }
  }

  private registerHostHandlers(
    socket: Socket,
    io: Server,
    gameCode: string,
    gameSessionId: string,
  ) {
    socket.on("remove-player", async (p: { id: string }) => {
      try {
        const removed = await this.realtimeService.removePlayer(
          p.id,
          gameSessionId,
        );
        if (removed) {
          this.logger.log(`Player ${p.id} removed from ${gameCode}`);
          io.to(gameCode).emit("player-removed", p);
        }
      } catch (error) {
        this.logger.error("Error removing player:", error);
      }
    });

    socket.on("start-game", async () => {
      try {
        await this.realtimeService.startGame(gameCode);
        this.logger.log(`Game ${gameCode} started`);
        io.to(gameCode).emit("game-started");
      } catch (error) {
        this.logger.error("Error starting game:", error);
      }
    });

    socket.on("start-timer", () => {
      io.to(gameCode).emit("timer-starts");
    });

    socket.on("set-question-index", async (_gc: string, index: number) => {
      try {
        await this.realtimeService.setQuestionIndex(gameCode, index);
        this.logger.log(`Question index ${index} for Game ${gameCode}`);
        io.to(gameCode).emit("get-question-index", index);
      } catch (error) {
        this.logger.error("Error setting question index:", error);
      }
    });

    socket.on("change-question", async (_gc: string, index: number) => {
      try {
        await this.realtimeService.setQuestionIndex(gameCode, index);
        this.logger.log(`Question changed to ${index} for Game ${gameCode}`);
        io.to(gameCode).emit("question-changed", index);
      } catch (error) {
        this.logger.error("Error changing question:", error);
      }
    });

    socket.on(
      "display-result",
      async (_gc: string, quesId: string, options: { id: string }[]) => {
        try {
          const data = await this.realtimeService.getResultData(
            gameCode,
            quesId,
            options,
          );
          io.to(gameCode).emit("displaying-result", data);
        } catch (error) {
          this.logger.error("Error displaying result:", error);
        }
      },
    );

    socket.on("display-leaderboard", () => {
      io.to(gameCode).emit("displaying-leaderboard");
    });

    socket.on("final-leaderboard", async () => {
      try {
        const leaderboard =
          await this.realtimeService.getFinalLeaderboard(gameCode);
        io.to(gameCode).emit("displaying-final-leaderboard", leaderboard);
      } catch (error) {
        this.logger.error("Error displaying final leaderboard:", error);
      }
    });

    socket.on("end-game-session", async () => {
      try {
        const ended = await this.realtimeService.endGameSession(gameCode);
        if (ended) {
          io.to(gameCode).emit("game-session-ended");
        }
      } catch (error) {
        this.logger.error("Error ending game session:", error);
      }
    });
  }

  private handleConnectionError(err: unknown, socket: Socket) {
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
