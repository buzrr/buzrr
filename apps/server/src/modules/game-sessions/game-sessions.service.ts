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

const generateGameCode = customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 6);

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
      include: { creator: { select: { hostSizeLimit: true } } },
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
    if (await this.engine.isBanned(game.gameCode, playerId)) {
      throw new ForbiddenException(
        "The host has banned you from this room. You can still join other rooms.",
      );
    }
    // Serializable so concurrent joins can't both pass the count and
    // overshoot the cap.
    await this.prisma.db.$transaction(
      async (tx) => {
        // Re-joining the same room (e.g. after a refresh) must never hit the cap.
        if (player.gameId !== game.id) {
          const limit = game.creator.hostSizeLimit;
          const playerCount = await tx.player.count({
            where: { gameId: game.id },
          });
          if (playerCount >= limit) {
            throw new ForbiddenException(
              `This room is full — rooms are capped at ${limit} players while Buzrr is in beta on free-tier infrastructure.`,
            );
          }
        }
        await tx.player.update({
          where: { id: playerId },
          data: { gameId: game.id },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { roomId: game.id, playerId };
  }

  async createRoom(
    user: AuthUser,
    dto: CreateRoomDto,
  ): Promise<{ id: string }> {
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

  /**
   * Host ends the room over HTTP — works even when the host's socket is down.
   * The engine broadcasts game-over / game-session-ended and tears down Redis
   * and Postgres; if no live session ever existed (no socket connected since
   * the room was created), fall back to cleaning up Postgres directly.
   */
  async endRoom(user: AuthUser, roomId: string): Promise<{ ended: true }> {
    const room = await this.prisma.db.gameSession.findUnique({
      where: { id: roomId },
    });
    if (!room) {
      throw new NotFoundException("Room not found");
    }
    if (room.creatorId !== user.userId) {
      throw new ForbiddenException("Unauthorized");
    }

    await this.engine.endGame(room.gameCode);

    const remaining = await this.prisma.db.gameSession.findUnique({
      where: { id: roomId },
      select: { id: true },
    });
    if (remaining) {
      await this.prisma.db.$transaction([
        this.prisma.db.player.updateMany({
          where: { gameId: roomId },
          data: { gameId: null },
        }),
        // deleteMany: idempotent if a concurrent endGame won the claim.
        this.prisma.db.gameSession.deleteMany({ where: { id: roomId } }),
      ]);
    }
    return { ended: true };
  }

  /**
   * Host kicks a player over HTTP — works even when the host's socket is down.
   * The player keeps their identity: only the room membership is dropped, so
   * their client lands back on the room-code screen and can join elsewhere.
   */
  async removePlayerFromRoom(
    user: AuthUser,
    roomId: string,
    playerId: string,
  ): Promise<{ removed: true }> {
    const { room, player } = await this.authorizeRoomPlayer(
      user,
      roomId,
      playerId,
    );
    await this.detachPlayer(roomId, player);
    await this.engine.kickPlayer(room.gameCode, {
      id: player.id,
      name: player.name,
      profilePic: player.profilePic,
    });
    return { removed: true };
  }

  /**
   * Host bans a player over HTTP: same removal as a kick, plus a room-scoped
   * ban that blocks any rejoin (HTTP join and socket connect) for as long as
   * this room lives.
   */
  async banPlayerFromRoom(
    user: AuthUser,
    roomId: string,
    playerId: string,
  ): Promise<{ banned: true }> {
    const { room, player } = await this.authorizeRoomPlayer(
      user,
      roomId,
      playerId,
    );
    // Record the ban before releasing the room membership: between the two,
    // `join` would otherwise still see an unbanned player and let them back in.
    await this.engine.banPlayer(room.gameCode, {
      id: player.id,
      name: player.name,
      profilePic: player.profilePic,
    });
    await this.detachPlayer(roomId, player);
    return { banned: true };
  }

  /** Shared host-authorization behind kick and ban. */
  private async authorizeRoomPlayer(
    user: AuthUser,
    roomId: string,
    playerId: string,
  ) {
    const room = await this.prisma.db.gameSession.findUnique({
      where: { id: roomId },
    });
    if (!room) {
      throw new NotFoundException("Room not found");
    }
    if (room.creatorId !== user.userId) {
      throw new ForbiddenException("Unauthorized");
    }

    const player = await this.prisma.db.player.findUnique({
      where: { id: playerId },
    });
    // A detached player (gameId null) is still kickable so that a retry can
    // finish the Redis removal + broadcast if a previous attempt failed after
    // the Postgres update; only a player in a *different* room is rejected.
    if (!player || (player.gameId !== null && player.gameId !== roomId)) {
      throw new NotFoundException("Player is not in this room");
    }

    return { room, player };
  }

  /** Drops the room membership. The player row itself is never deleted. */
  private async detachPlayer(
    roomId: string,
    player: { id: string; gameId: string | null },
  ): Promise<void> {
    if (player.gameId !== roomId) return;
    await this.prisma.db.player.update({
      where: { id: player.id },
      data: { gameId: null },
    });
  }

  async getAdminLobby(user: AuthUser, roomId: string) {
    const room = await this.prisma.db.gameSession.findUnique({
      where: { id: roomId },
      include: { creator: { select: { hostSizeLimit: true } } },
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
    const { creator, ...roomData } = room;
    return { room: roomData, players, quiz, maxPlayers: creator.hostSizeLimit };
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
