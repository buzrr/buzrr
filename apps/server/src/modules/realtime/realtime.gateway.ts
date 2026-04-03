import { Logger } from "@nestjs/common";
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { GameStates, type Player } from "@buzrr/prisma";
import { Server, Socket } from "socket.io";
import { PrismaService } from "../../prisma/prisma.service";
import { parseCorsOrigin } from "../../common/utils/parse-cors-origin";

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

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(socket: Socket): Promise<void> {
    const io = this.server;
    this.logger.log(`New connection: ${socket.id}`);

    const userType = socket.handshake.query.userType as string;
    const playerId = socket.handshake.query.playerId as string;
    const adminId = socket.handshake.query.adminId as string;

    let player: Player | null = null;
    let gameCode: string;
    let gameSessionId: string;
    let isRoomHost = false;

    try {
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

      gameSessionId = game.id;

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

        const inSession =
          player.gameId == null || player.gameId === gameSessionId;
        if (!inSession) {
          this.logger.log(
            `Player ${playerId} is not a member of game ${gameCode}... Disconnecting Socket: ${socket.id}`,
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

        if (adminId !== game.creatorId) {
          this.logger.log(
            `Admin ${adminId} is not the host of game ${gameCode}... Disconnecting Socket: ${socket.id}`,
          );
          socket.disconnect();
          return;
        }

        isRoomHost = true;
      } else {
        this.logger.log(
          `Invalid userType: ${userType} — Disconnecting Socket: ${socket.id}`,
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

    if (!isRoomHost) {
      return;
    }

    socket.on("remove-player", async (p: { id: string }) => {
      try {
        const result = await this.prisma.db.player.updateMany({
          where: { id: p.id, gameId: gameSessionId },
          data: { gameId: null },
        });

        if (result.count < 1) {
          return;
        }

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

        io.to(gameCode).emit("game-session-ended");
      } catch (error) {
        this.logger.error("Error deleting player answers:", error);
      }
    });
  }
}
