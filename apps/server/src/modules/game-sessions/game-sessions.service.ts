import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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

  async join(dto: JoinRoomDto): Promise<{ roomId: string; playerId: string }> {
    const game = await this.prisma.db.gameSession.findUnique({
      where: { gameCode: dto.gameCode },
    });
    if (!game) {
      throw new NotFoundException("Game not found");
    }
    const player = await this.prisma.db.player.findUnique({
      where: { id: dto.playerId },
    });
    if (!player) {
      throw new NotFoundException("Player not found");
    }
    await this.prisma.db.player.update({
      where: { id: dto.playerId },
      data: { gameId: game.id },
    });
    return { roomId: game.id, playerId: dto.playerId };
  }

  async createRoom(user: AuthUser, dto: CreateRoomDto): Promise<{ id: string }> {
    const quiz = await this.prisma.db.quiz.findFirst({
      where: { id: dto.quizId, userId: user.userId },
    });
    if (!quiz) {
      throw new NotFoundException("Unauthorized or quiz not found");
    }
    const gameCode = generateGameCode();
    const room = await this.prisma.db.gameSession.create({
      data: {
        gameCode,
        quizId: dto.quizId,
        creatorId: user.userId,
      },
    });
    return { id: room.id };
  }

  async submitAnswer(
    gameSessionId: string,
    dto: SubmitAnswerDto,
  ): Promise<void> {
    await this.prisma.db.$transaction(async (tx) => {
      const option = await tx.option.findUnique({
        where: { id: dto.optionId },
        include: { question: true },
      });
      if (!option?.questionId) {
        throw new BadRequestException("Invalid option");
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

      const leaderboard = await tx.gameLeaderboard.findUnique({
        where: {
          playerId_gameSessionId: {
            playerId: dto.playerId,
            gameSessionId,
          },
        },
      });

      if (leaderboard) {
        await tx.gameLeaderboard.update({
          where: {
            playerId_gameSessionId: {
              playerId: dto.playerId,
              gameSessionId,
            },
          },
          data: { score: leaderboard.score + delta },
        });
      } else {
        await tx.gameLeaderboard.create({
          data: {
            playerId: dto.playerId,
            gameSessionId,
            score: delta,
          },
        });
      }
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
