import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentAccountUser,
  CurrentPlayerUser,
} from "../../common/decorators/current-user.decorator";
import type {
  AuthUser,
  PlayerAuthUser,
} from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { CreateRoomDto } from "./dto/create-room.dto";
import { JoinRoomDto } from "./dto/join-room.dto";
import { SubmitAnswerDto } from "./dto/submit-answer.dto";
import { GameSessionsService } from "./game-sessions.service";

@Controller("game-sessions")
export class GameSessionsController {
  constructor(private readonly gameSessions: GameSessionsService) {}

  @UseGuards(RateLimitGuard)
  @Post("join")
  join(@CurrentPlayerUser() player: PlayerAuthUser, @Body() dto: JoinRoomDto) {
    return this.gameSessions.join(player.playerId, dto);
  }

  @Public()
  @UseGuards(RateLimitGuard)
  @Get("player-play/:playerId")
  playerPlay(@Param("playerId") playerId: string) {
    return this.gameSessions.getPlayerPlayContext(playerId);
  }

  @Get("by-code/:gameCode/leaderboard")
  leaderboardByCode(@Param("gameCode") gameCode: string) {
    return this.gameSessions.leaderboardByCode(gameCode);
  }

  @Get(":roomId/lobby")
  adminLobby(
    @CurrentAccountUser() user: AuthUser,
    @Param("roomId") roomId: string,
  ) {
    return this.gameSessions.getAdminLobby(user, roomId);
  }

  @Get(":roomId/leaderboard")
  leaderboardByRoom(@Param("roomId") roomId: string) {
    return this.gameSessions.leaderboardByRoomId(roomId);
  }

  @Post()
  create(@CurrentAccountUser() user: AuthUser, @Body() dto: CreateRoomDto) {
    return this.gameSessions.createRoom(user, dto);
  }

  @Public()
  @Post(":id/answers")
  @HttpCode(HttpStatus.NO_CONTENT)
  submitAnswer(
    @Param("id") id: string,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.gameSessions.submitAnswer(id, dto);
  }
}
