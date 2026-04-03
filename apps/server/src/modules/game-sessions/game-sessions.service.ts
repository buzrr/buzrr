import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@buzrr/prisma";
import { customAlphabet } from "nanoid";
import { PrismaService } from "../../prisma/prisma.service";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { CreateRoomDto } from "./dto/create-room.dto";
import { JoinRoomDto } from "./dto/join-room.dto";
import { SubmitAnswerDto } from "./dto/submit-answer.dto";

const generateGameCode = customAlphabet(
  "ABCDEFGHJKMNPQRSTUVWXYZ23456789",
  6,
);

@Injectable()
export class GameSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async join(
    playerId: string,
    dto: JoinRoomDto,
  ): Promise<{ roomId: string; playerId: string }> {
    const game = await this.prisma.db.gameSession.findUnique({
      where: { gameCode: dto.gameCode },
    });
    if (!game) {
      throw new NotFoundException("Game not found");
    }
    const player = await this.prisma.db.player.findUnique({
      where: { id: playerId },
    });
    if (!player) {
      throw new NotFoundException("Player not found");
    }
    await this.prisma.db.player.update({
      where: { id: playerId },
      data: { gameId: game.id },
    });
    return { roomId: game.id, playerId };
  }

  async createRoom(user: AuthUser, dto: CreateRoomDto): Promise<{ id: string }> {
    const quiz = await this.prisma.db.quiz.findFirst({
      where: { id: dto.quizId, userId: user.userId },
    });
    if (!quiz) {
      throw new NotFoundException("Unauthorized or quiz not found");
    }
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const gameCode = generateGameCode();
      try {
        const room = await this.prisma.db.gameSession.create({
          data: {
            gameCode,
            quizId: dto.quizId,
            creatorId: user.userId,
          },
        });
        return { id: room.id };
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          continue;
        }
        throw e;
      }
    }
    throw new InternalServerErrorException(
      "Could not allocate a unique room code. Please try again.",
    );
  }

  async submitAnswer(
    gameSessionId: string,
    dto: SubmitAnswerDto,
  ): Promise<void> {
    await this.prisma.db.$transaction(async (tx) => {
      const session = await tx.gameSession.findUnique({
        where: { id: gameSessionId },
        select: { id: true, quizId: true },
      });
      if (!session) {
        throw new NotFoundException("Game session not found");
      }

      const option = await tx.option.findUnique({
        where: { id: dto.optionId },
        include: { question: true },
      });
      if (!option?.questionId || !option.question) {
        throw new BadRequestException("Invalid option");
      }
      if (option.question.quizId !== session.quizId) {
        throw new BadRequestException("Option does not belong to this quiz");
      }

      const player = await tx.player.findUnique({
        where: { id: dto.playerId },
      });
      if (!player) {
        throw new NotFoundException("Player not found");
      }
      if (player.gameId !== session.id) {
        throw new ForbiddenException("Player is not in this game session");
      }

      let score = option.isCorrect ? 1000 : 0;
      if (option.isCorrect) {
        const timeLimit = option.question.timeOut;
        if (dto.timeTaken < timeLimit) {
          score -= (dto.timeTaken / timeLimit) * 900;
        } else {
          score = 100;
        }
      }
      const roundedScore = Math.round(score);

      const prevAns = await tx.playerAnswer.findUnique({
        where: {
          playerId_questionId_gameSessionId: {
            playerId: dto.playerId,
            questionId: option.questionId,
            gameSessionId,
          },
        },
      });

      await tx.playerAnswer.upsert({
        where: {
          playerId_questionId_gameSessionId: {
            playerId: dto.playerId,
            questionId: option.questionId,
            gameSessionId,
          },
        },
        create: {
          playerId: dto.playerId,
          questionId: option.questionId,
          gameSessionId,
          optionId: dto.optionId,
          timeTaken: dto.timeTaken,
          isCorrect: option.isCorrect,
          score: roundedScore,
        },
        update: {
          optionId: dto.optionId,
          timeTaken: dto.timeTaken,
          isCorrect: option.isCorrect,
          score: roundedScore,
        },
      });

      const delta = roundedScore - (prevAns?.score ?? 0);

      await tx.gameLeaderboard.upsert({
        where: {
          playerId_gameSessionId: {
            playerId: dto.playerId,
            gameSessionId,
          },
        },
        create: {
          playerId: dto.playerId,
          gameSessionId,
          score: delta,
        },
        update: {
          score: { increment: delta },
        },
      });
    });
  }

  async leaderboardByCode(gameCode: string) {
    const room = await this.prisma.db.gameSession.findUnique({
      where: { gameCode },
    });
    if (!room) {
      throw new NotFoundException("Room not found");
    }
    return this.prisma.db.gameLeaderboard.findMany({
      where: { gameSessionId: room.id },
      include: { Player: true },
      orderBy: { score: "desc" },
    });
  }

  async getAdminLobby(user: AuthUser, roomId: string) {
    const room = await this.prisma.db.gameSession.findUnique({
      where: { id: roomId },
    });
    if (!room) {
      throw new NotFoundException("Room not found");
    }
    if (room.creatorId !== user.userId) {
      throw new ForbiddenException("Unauthorized");
    }
    const players = await this.prisma.db.player.findMany({
      where: { gameId: roomId },
    });
    const quiz = await this.prisma.db.quiz.findUnique({
      where: { id: room.quizId },
      include: {
        questions: {
          include: { options: true },
        },
      },
    });
    if (!quiz) {
      throw new NotFoundException("Quiz not found");
    }
    return { room, players, quiz };
  }

  async leaderboardByRoomId(roomId: string) {
    const room = await this.prisma.db.gameSession.findUnique({
      where: { id: roomId },
    });
    if (!room) {
      throw new NotFoundException("Room not found");
    }
    return this.prisma.db.gameLeaderboard.findMany({
      where: { gameSessionId: roomId },
      include: { Player: true },
      orderBy: { score: "desc" },
    });
  }

  async getPlayerPlayContext(playerId: string) {
    const player = await this.prisma.db.player.findUnique({
      where: { id: playerId },
    });
    if (!player) {
      throw new NotFoundException("Player not found");
    }
    if (!player.gameId) {
      return { player, game: null };
    }
    const game = await this.loadGameForPlay(player.gameId);
    return { player, game };
  }

  private async loadGameForPlay(gameSessionId: string) {
    return this.prisma.db.gameSession.findUnique({
      where: { id: gameSessionId },
      include: {
        quiz: {
          include: {
            questions: {
              include: {
                options: {
                  select: { id: true, title: true },
                },
              },
            },
          },
        },
        creator: {
          select: { name: true, image: true },
        },
      },
    });
  }
}
