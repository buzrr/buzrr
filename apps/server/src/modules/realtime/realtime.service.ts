import { Injectable, Logger } from "@nestjs/common";
import { GameStates } from "@buzrr/prisma";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private readonly prisma: PrismaService) {}

  async removePlayer(playerId: string, gameSessionId: string) {
    const result = await this.prisma.db.player.updateMany({
      where: { id: playerId, gameId: gameSessionId },
      data: { gameId: null },
    });
    return result.count > 0;
  }

  async startGame(gameCode: string) {
    await this.prisma.db.gameSession.update({
      where: { gameCode },
      data: { isPlaying: true },
    });
  }

  async setQuestionIndex(gameCode: string, index: number) {
    await this.prisma.db.gameSession.update({
      where: { gameCode },
      data: { currentQuestion: index },
    });
  }

  async getResultData(
    gameCode: string,
    quesId: string,
    options: { id: string }[],
  ) {
    const room = await this.prisma.db.gameSession.update({
      where: { gameCode },
      data: { gameState: GameStates.answer },
    });

    const optionCounts = await Promise.all(
      options.map((opt) =>
        this.prisma.db.playerAnswer.count({
          where: {
            questionId: quesId,
            optionId: opt.id,
            gameSessionId: room.id,
          },
        }),
      ),
    );

    const playerAnswers = await this.prisma.db.playerAnswer.findMany({
      where: { gameSessionId: room.id, questionId: quesId },
      select: { isCorrect: true, playerId: true },
    });

    return { presenter: optionCounts, player: playerAnswers };
  }

  async getFinalLeaderboard(gameCode: string) {
    const room = await this.prisma.db.gameSession.update({
      where: { gameCode },
      data: { gameState: GameStates.leaderboard },
    });

    const leaderboard = await this.prisma.db.gameLeaderboard.findMany({
      where: { gameSessionId: room.id },
      include: { Player: true },
      orderBy: { score: "desc" },
    });

    return leaderboard.map((entry, index) => ({
      ...entry,
      position: index + 1,
    }));
  }

  async endGameSession(gameCode: string) {
    const gameSession = await this.prisma.db.gameSession.findUnique({
      where: { gameCode },
    });

    if (!gameSession) {
      this.logger.error(`Game Session ${gameCode} not found!`);
      return false;
    }

    await this.prisma.db.playerAnswer.deleteMany({
      where: { gameSessionId: gameSession.id },
    });

    return true;
  }

  async validateConnection(socket: {
    handshake: { query: Record<string, string | string[] | undefined> };
  }) {
    const userType = socket.handshake.query.userType as string;
    const playerId = socket.handshake.query.playerId as string;
    const adminId = socket.handshake.query.adminId as string;
    const gameCode = socket.handshake.query.gameCode as string;

    const game = await this.prisma.db.gameSession.findUnique({
      where: { gameCode },
    });

    if (!game) {
      return { valid: false as const, reason: `Game ${gameCode} not found` };
    }

    if (userType === "player") {
      const player = await this.prisma.db.player.findUnique({
        where: { id: playerId },
      });

      if (!player) {
        return { valid: false as const, reason: `Player ${playerId} not found` };
      }

      const inSession = player.gameId == null || player.gameId === game.id;
      if (!inSession) {
        return {
          valid: false as const,
          reason: `Player ${playerId} is not in game ${gameCode}`,
        };
      }

      return {
        valid: true as const,
        userType: "player" as const,
        player,
        gameCode,
        gameSessionId: game.id,
        isRoomHost: false,
      };
    }

    if (userType === "admin") {
      const admin = await this.prisma.db.user.findUnique({
        where: { id: adminId },
      });

      if (!admin) {
        return { valid: false as const, reason: `Admin ${adminId} not found` };
      }

      if (adminId !== game.creatorId) {
        return {
          valid: false as const,
          reason: `Admin ${adminId} is not the host of game ${gameCode}`,
        };
      }

      return {
        valid: true as const,
        userType: "admin" as const,
        player: null,
        gameCode,
        gameSessionId: game.id,
        isRoomHost: true,
      };
    }

    return { valid: false as const, reason: `Invalid userType: ${userType}` };
  }
}
