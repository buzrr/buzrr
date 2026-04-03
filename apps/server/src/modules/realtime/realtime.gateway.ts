import { Logger } from "@nestjs/common";
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { GameStates, type Player } from "@buzrr/prisma";
import { Server, Socket } from "socket.io";
import { PrismaService } from "../../prisma/prisma.service";

function socketCorsOrigin(): boolean | string | string[] {
  const raw = process.env.WEB_ORIGIN;
  if (raw === undefined || raw === "") {
    return true;
  }
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  if (raw.includes(",")) {
    return raw.split(",").map((s) => s.trim());
  }
  return raw;
}

@WebSocketGateway({
  cors: {
    origin: socketCorsOrigin(),
    credentials: true,
    allowedHeaders: ["*"],
  },
})
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(socket: Socket): Promise<void> {
    const io = this.server;
    this.logger.log(`New connection: ${socket.id}`);

    const userType = socket.handshake.query.userType as string;
    const playerId = socket.handshake.query.playerId as string;
    const adminId = socket.handshake.query.adminId as string;

    let player: Player | null = null;
    let gameCode: string;

    try {
      if (userType === "player") {
        player = await this.prisma.db.player.findUnique({
          where: { id: playerId },
        });

        if (!player) {
          this.logger.log(
            `Player ${playerId} not found... Disconnecting Socket: ${socket.id}`,
          );
          socket.disconnect();
          return;
        }
      } else if (userType === "admin") {
        const admin = await this.prisma.db.user.findUnique({
          where: { id: adminId },
        });

        if (!admin) {
          this.logger.log(
            `Admin ${adminId} not found... Disconnecting Socket: ${socket.id}`,
          );
          socket.disconnect();
          return;
        }
      } else {
        this.logger.log(
          `Invalid userType: ${userType} — Disconnecting Socket: ${socket.id}`,
        );
        socket.disconnect();
        return;
      }

      gameCode = socket.handshake.query.gameCode as string;

      const game = await this.prisma.db.gameSession.findUnique({
        where: { gameCode },
      });

      if (!game) {
        this.logger.log(
          `Game ${gameCode} not found... Disconnecting Socket: ${socket.id}`,
        );
        socket.disconnect();
        return;
      }

      await socket.join(gameCode);
    } catch (err) {
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
      return;
    }

    this.logger.log(
      `${userType === "player" ? `Player: ${playerId}` : `Admin: ${adminId}`} with SocketId: ${socket.id} joined Game: ${gameCode}`,
    );

    if (userType === "player" && player) {
      io.to(gameCode).emit("player-joined", player);
    }

    socket.on("remove-player", async (p: { id: string }) => {
      try {
        await this.prisma.db.player.update({
          where: { id: p.id },
          data: { gameId: null },
        });

        this.logger.log(`Player ${p.id} removed from ${gameCode}`);

        io.to(gameCode).emit("player-removed", p);
      } catch (error) {
        this.logger.error("Error removing player:", error);
      }
    });

    socket.on("start-game", async () => {
      try {
        await this.prisma.db.gameSession.update({
          where: { gameCode },
          data: { isPlaying: true },
        });

        this.logger.log(`Game ${gameCode} started`);

        io.to(gameCode).emit("game-started");
      } catch (error) {
        this.logger.error("Error starting game:", error);
      }
    });

    socket.on("start-timer", async () => {
      this.logger.log("start timer");
      io.to(gameCode).emit("timer-starts");
    });

    socket.on("set-question-index", async (_gc: string, index: number) => {
      try {
        await this.prisma.db.gameSession.update({
          where: { gameCode },
          data: { currentQuestion: index },
        });

        this.logger.log(
          `Current question index is ${index} of Game ${gameCode}`,
        );

        io.to(gameCode).emit("get-question-index", index);
      } catch (error) {
        this.logger.error("Error setting question index:", error);
      }
    });

    socket.on("change-question", async (_gc: string, index: number) => {
      try {
        await this.prisma.db.gameSession.update({
          where: { gameCode },
          data: { currentQuestion: index },
        });

        this.logger.log(
          `Current question index is ${index} of Game ${gameCode}`,
        );

        io.to(gameCode).emit("question-changed", index);
      } catch (error) {
        this.logger.error("Error setting question index:", error);
      }
    });

    socket.on(
      "display-result",
      async (
        _gc: string,
        quesId: string,
        options: { id: string }[],
      ) => {
        try {
          const room = await this.prisma.db.gameSession.update({
            where: { gameCode },
            data: { gameState: GameStates.answer },
          });

          const playerCount: number[] = [];
          for (const opt of options) {
            const count = await this.prisma.db.playerAnswer.count({
              where: {
                questionId: quesId,
                optionId: opt.id,
                gameSessionId: room?.id,
              },
            });
            playerCount.push(count);
          }

          const playerAnswers = await this.prisma.db.playerAnswer.findMany({
            where: {
              gameSessionId: room?.id,
              questionId: quesId,
            },
            select: {
              isCorrect: true,
              playerId: true,
            },
          });

          const data = {
            presenter: playerCount,
            player: playerAnswers,
          };

          this.logger.log(
            `Result displaying with data ${JSON.stringify(data)}`,
          );
          io.to(gameCode).emit("displaying-result", data);
        } catch (error) {
          this.logger.error("Error displaying result:", error);
        }
      },
    );

    socket.on("display-leaderboard", async () => {
      this.logger.log("Present leaderboard");
      io.to(gameCode).emit("displaying-leaderboard");
    });

    socket.on("final-leaderboard", async () => {
      try {
        const room = await this.prisma.db.gameSession.update({
          where: { gameCode },
          data: { gameState: GameStates.leaderboard },
        });
        const leaderboard = await this.prisma.db.gameLeaderboard.findMany({
          where: {
            gameSessionId: room?.id,
          },
          include: {
            Player: true,
          },
          orderBy: {
            score: "desc",
          },
        });

        const newleaderboard = leaderboard.map((entry, index) => ({
          ...entry,
          position: index + 1,
        }));

        io.to(gameCode).emit("displaying-final-leaderboard", newleaderboard);
      } catch (error) {
        this.logger.error("Error displaying final leaderboard:", error);
      }
    });

    socket.on("end-game-session", async () => {
      try {
        const gameSession = await this.prisma.db.gameSession.findUnique({
          where: { gameCode },
        });

        if (!gameSession) {
          this.logger.error(`Game Session ${gameCode} not found!`);
          return;
        }

        await this.prisma.db.playerAnswer.deleteMany({
          where: {
            gameSessionId: gameSession.id,
          },
        });
      } catch (error) {
        this.logger.error("Error deleting player answers:", error);
      }
      io.to(gameCode).emit("game-session-ended");
    });
  }
}
