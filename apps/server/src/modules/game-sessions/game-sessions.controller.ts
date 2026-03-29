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
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { CreateRoomDto } from "./dto/create-room.dto";
import { JoinRoomDto } from "./dto/join-room.dto";
import { SubmitAnswerDto } from "./dto/submit-answer.dto";
import { GameSessionsService } from "./game-sessions.service";

@Controller("game-sessions")
export class GameSessionsController {
  constructor(private readonly gameSessions: GameSessionsService) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @Post("join")
  join(@Body() dto: JoinRoomDto) {
    return this.gameSessions.join(dto);
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
    @CurrentUser() user: AuthUser,
    @Param("roomId") roomId: string,
  ) {
    return this.gameSessions.getAdminLobby(user, roomId);
  }

  @Get(":roomId/leaderboard")
  leaderboardByRoom(@Param("roomId") roomId: string) {
    return this.gameSessions.leaderboardByRoomId(roomId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateRoomDto) {
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
