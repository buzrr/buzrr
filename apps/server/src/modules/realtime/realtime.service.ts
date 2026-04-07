import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { GameStates } from "@buzrr/prisma";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

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
    _options: { id: string }[],
  ) {
    const room = await this.prisma.db.gameSession.update({
      where: { gameCode },
      data: { gameState: GameStates.answer },
    });

    const question = await this.prisma.db.question.findFirst({
      where: {
        id: quesId,
        quiz: {
          gameSessions: {
            some: { id: room.id },
          },
        },
      },
      include: {
        options: {
          orderBy: { createdAt: "asc" },
          select: { id: true },
        },
      },
    });

    const canonicalOptions = question?.options ?? [];

    const optionCounts = await Promise.all(
      canonicalOptions.map((opt) =>
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

    await this.prisma.db.$transaction([
      this.prisma.db.playerAnswer.deleteMany({
        where: { gameSessionId: gameSession.id },
      }),
      this.prisma.db.player.updateMany({
        where: { gameId: gameSession.id },
        data: { gameId: null },
      }),
      this.prisma.db.gameSession.delete({
        where: { id: gameSession.id },
      }),
    ]);

    return true;
  }

  async validateConnection(socket: {
    handshake: {
      query: Record<string, string | string[] | undefined>;
      auth?: Record<string, unknown>;
      headers?: Record<string, string | string[] | undefined>;
    };
  }) {
    const normalizeQueryValue = (
      value: string | string[] | undefined,
    ): string => {
      if (Array.isArray(value)) {
        return (value[0] ?? "").trim();
      }
      return (value ?? "").trim();
    };

    const userType = normalizeQueryValue(socket.handshake.query.userType);
    const gameCode = normalizeQueryValue(socket.handshake.query.gameCode);
    const validUserType = userType === "player" || userType === "admin";
    const validGameCode = /^[a-zA-Z0-9_-]{4,20}$/.test(gameCode);
    if (!validUserType || !validGameCode) {
      return { valid: false as const };
    }
    const authHeader = socket.handshake.headers?.authorization;
    const cookieHeader = socket.handshake.headers?.cookie;
    const bearerToken =
      typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : undefined;
    const authToken =
      (typeof socket.handshake.auth?.token === "string"
        ? socket.handshake.auth.token
        : undefined) ?? bearerToken;

    let payload: { sub?: string; typ?: string } | null = null;
    if (authToken) {
      try {
        payload = await this.jwt.verifyAsync<{ sub?: string; typ?: string }>(
          authToken,
        );
      } catch {
        return { valid: false as const, reason: "Invalid auth token" };
      }
    }

    const game = await this.prisma.db.gameSession.findUnique({
      where: { gameCode },
    });

    if (!game) {
      return { valid: false as const, reason: `Game ${gameCode} not found` };
    }

    if (userType === "player") {
      if (!payload?.sub || payload.typ !== "player") {
        return {
          valid: false as const,
          reason: "Token role mismatch for player connection",
        };
      }

      const player = await this.prisma.db.player.findUnique({
        where: { id: payload.sub },
      });

      if (!player) {
        return { valid: false as const, reason: `Player ${payload.sub} not found` };
      }

      const inSession = player.gameId !== null && player.gameId === game.id;
      if (!inSession) {
        return {
          valid: false as const,
          reason: `Player ${payload.sub} is not in game ${gameCode}`,
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
      let adminId = payload?.sub;

      if (!adminId && typeof cookieHeader === "string") {
        const cookies = cookieHeader
          .split(";")
          .map((cookie) => cookie.trim().split("="))
          .reduce<Record<string, string>>((acc, [key, value]) => {
            if (key && value) acc[key] = decodeURIComponent(value);
            return acc;
          }, {});
        const sessionToken =
          cookies["authjs.session-token"] ??
          cookies["__Secure-authjs.session-token"];
        if (sessionToken) {
          const session = await this.prisma.db.session.findUnique({
            where: { sessionToken },
            select: { userId: true },
          });
          adminId = session?.userId;
        }
      }

      if (!adminId || payload?.typ === "player") {
        return {
          valid: false as const,
          reason: "Token role mismatch for admin connection",
        };
      }

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
