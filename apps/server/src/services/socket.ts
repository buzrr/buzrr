import { Server } from "socket.io";
import { prisma } from "../utils/prisma";
import { GameStates } from "@prisma/client";

class SocketService {
  private _io: Server;
  private prisma: typeof prisma;
  constructor() {
    console.log("Init Socket Service...");

    this._io = new Server({
      cors: {
        allowedHeaders: ["*"],
        origin: "*",
      },
    });

    this.prisma = prisma;
  }

  public initListeners() {
    const io = this.io;
    console.log("Init Socket Listeners...");

    io.on("connection", async (socket) => {
      console.log("New connection:", socket.id);

      const userType = socket.handshake.query.userType as string;
      const playerId = socket.handshake.query.playerId as string;
      const adminId = socket.handshake.query.adminId as string;

      let player;
      let gameCode: string;

      try {
        // check if player or admin exists

        if (userType === "player") {
          player = await this.prisma.player.findUnique({
            where: {
              id: playerId,
            },
          });

          if (!player) {
            console.log(
              "Player",
              playerId,
              "not found... \nDisconnecting Socket:",
              socket.id
            );
            socket.disconnect();
            return;
          }
        } else if (userType === "admin") {
          const admin = await this.prisma.user.findUnique({
            where: {
              id: adminId,
            },
          });

          if (!admin) {
            console.log(
              "Admin: ",
              adminId,
              "not found... \nDisconnecting Socket:",
              socket.id
            );
            socket.disconnect();
            return;
          }
        } else {
          console.log(
            "Invalid userType:",
            userType,
            "\nDisconnecting Socket:",
            socket.id
          );
          socket.disconnect();
          return;
        }
        gameCode = socket.handshake.query.gameCode as string;

        const game = await this.prisma.gameSession.findUnique({
          where: {
            gameCode,
          },
        });

        if (!game) {
          console.log(
            "Game: ",
            gameCode,
            "not found... \nDisconnecting Socket:",
            socket.id
          );
          socket.disconnect();
          return;
        }

        socket.join(gameCode);
      } catch (err) {
        const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : "";
        if (code === "ECONNREFUSED" || code === "P1001") {
          console.error(
            "Database unavailable. Disconnecting socket:",
            socket.id,
            err instanceof Error ? err.message : err
          );
        } else {
          console.error("Error during socket connection:", err);
        }
        socket.disconnect();
        return;
      }

      console.log(
        userType === "player" ? `Player: ${playerId}` : `Admin: ${adminId}`,
        "with SocketId:",
        socket.id,
        "joined Game:",
        gameCode
      );

      if (userType === "player") {
        io.to(gameCode).emit("player-joined", player);
      }

      // remove player
      socket.on("remove-player", async (player, gameCode) => {
        try {
          await this.prisma.player.update({
            where: { id: player.id },
            data: {
              gameId: null,
            },
          });

          console.log("Player", player.id, "removed from", gameCode);

          io.to(gameCode).emit("player-removed", player);
        } catch (error) {
          console.error("Error removing player:", error);
        }
      });

      // start game
      socket.on("start-game", async (gameCode) => {
        await this.prisma.gameSession.update({
          where: { gameCode },
          data: {
            isPlaying: true,
          },
        });

        console.log("Game", gameCode, "started");

        io.to(gameCode).emit("game-started");
      });

      // set timer
      socket.on("start-timer", async (gameCode) => {
        console.log("start timer");
        io.to(gameCode).emit("timer-starts");
      });

      // update question
      socket.on("set-question-index", async (gameCode, index) => {
        try {
          await this.prisma.gameSession.update({
            where: { gameCode },
            data: {
              currentQuestion: index,
            },
          });

          console.log("Current question index is", index, " of Game", gameCode);

          io.to(gameCode).emit("get-question-index", index);
        } catch (error) {
          console.error("Error setting question index:", error);
        }
      });

      // change question from leaderboard (presenter side)
      socket.on("change-question", async (gameCode, index) => {
        try {
          await this.prisma.gameSession.update({
            where: { gameCode },
            data: {
              currentQuestion: index,
            },
          });

          console.log("Current question index is", index, " of Game", gameCode);

          io.to(gameCode).emit("question-changed", index);
        } catch (error) {
          console.error("Error setting question index:", error);
        }
      });

      // show result
      socket.on("display-result", async (gameCode, quesId, options) => {
        try {
          const room = await this.prisma.gameSession.update({
            where: { gameCode },
            data: {
              gameState: GameStates.answer,
            },
          });

          // return player counts for presenter
          const playerCount = [];
          for (const opt of options) {
            const count = await this.prisma.playerAnswer.count({
              where: {
                questionId: quesId,
                optionId: opt.id,
                gameSessionId: room?.id,
              },
            });
            playerCount.push(count);
          }

          // return answer array for player
          const playerAnswers = await this.prisma.playerAnswer.findMany({
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

          console.log("Result displaying with data", JSON.stringify(data));
          io.to(gameCode).emit("displaying-result", data);
        } catch (error) {
          console.error("Error displaying result:", error);
        }
      });

      // display leaderboard
      socket.on("display-leaderboard", async (gameCode) => {
        console.log("Present leaderboard");
        io.to(gameCode).emit("displaying-leaderboard");
      });

      socket.on("final-leaderboard", async (gameCode) => {
        try {
          const room = await this.prisma.gameSession.update({
            where: { gameCode },
            data: {
              gameState: GameStates.leaderboard,
            },
          });
          const leaderboard = await this.prisma.gameLeaderboard.findMany({
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
          console.error("Error displaying final leaderboard:", error);
        }
      });

      socket.on("end-game-session", async (gameCode) => {
        try {
          const gameSession = await this.prisma.gameSession.findUnique({
            where: {
              gameCode,
            },
          });

          if (!gameSession) {
            console.error("Game Session by id: ", gameCode, " not found!");
            return;
          }

          await this.prisma.playerAnswer.deleteMany({
            where: {
              gameSessionId: gameSession.id,
            },
          });
        } catch (error) {
          console.error("Error deleting player answers:", error);
        }
        io.to(gameCode).emit("game-session-ended");
      });
    });
  }

  get io() {
    return this._io;
  }
}

export default SocketService;
