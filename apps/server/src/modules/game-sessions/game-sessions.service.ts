import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@buzrr/prisma";
import { customAlphabet } from "nanoid";
import { GameEngineService } from "../game-engine/game-engine.service";
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: GameEngineService,
  ) {}

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

  /**
   * Legacy fallback route. Scoring and timing are owned by the game engine —
   * `dto.timeTaken` is deliberately ignored; the server measures time from
   * the moment it opened the question. Prefer the `submit-answer` socket
   * event. This route is removed once all clients are migrated.
   */
  async submitAnswer(
    gameSessionId: string,
    dto: SubmitAnswerDto,
  ): Promise<void> {
    const session = await this.prisma.db.gameSession.findUnique({
      where: { id: gameSessionId },
      select: { id: true, gameCode: true },
    });
    if (!session) {
      throw new NotFoundException("Game session not found");
    }

    const player = await this.prisma.db.player.findUnique({
      where: { id: dto.playerId },
    });
    if (!player) {
      throw new NotFoundException("Player not found");
    }
    if (player.gameId !== session.id) {
      throw new ForbiddenException("Player is not in this game session");
    }

    const result = await this.engine.submitAnswerCurrent(
      session.gameCode,
      dto.playerId,
      dto.optionId,
    );
    if (!result.accepted) {
      throw new BadRequestException(result.reason ?? "Answer rejected");
    }
  }

  /** Finished games hosted by this user, newest first. */
  async getHistory(user: AuthUser) {
    return this.prisma.db.gameResult.findMany({
      where: { hostId: user.userId },
      orderBy: { endedAt: "desc" },
      take: 50,
      include: { _count: { select: { entries: true } } },
    });
  }

  /** A single finished game with its final standings. */
  async getResult(user: AuthUser, resultId: string) {
    const result = await this.prisma.db.gameResult.findUnique({
      where: { id: resultId },
      include: { entries: { orderBy: { rank: "asc" } } },
    });
    if (!result) {
      throw new NotFoundException("Result not found");
    }
    if (result.hostId) {
      if (result.hostId !== user.userId) {
        throw new ForbiddenException("Unauthorized");
      }
    } else if (!result.entries.some((e) => e.userId === user.userId)) {
      // Hostless (duel) results have no host to own them — only participants may view.
      throw new ForbiddenException("Unauthorized");
    }
    return result;
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
