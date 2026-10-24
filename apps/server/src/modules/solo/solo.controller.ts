import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  CurrentAccountUser,
  CurrentPlayerUser,
  type AuthUser,
  type PlayerAuthUser,
} from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { CreateSoloTestDto } from "./dto/create-solo-test.dto";
import { SoloAnswerDto } from "./dto/solo-answer.dto";
import { UpdateSoloTestDto } from "./dto/update-solo-test.dto";
import { SoloService } from "./solo.service";

/** The host's tests ("Play alone" links). */
@Controller("solo-tests")
export class SoloTestsController {
  constructor(private readonly solo: SoloService) {}

  @Post()
  create(@CurrentAccountUser() user: AuthUser, @Body() dto: CreateSoloTestDto) {
    return this.solo.create(user, dto);
  }

  @Get()
  list(@CurrentAccountUser() user: AuthUser, @Query("quizId") quizId?: string) {
    return this.solo.list(user, quizId);
  }

  @Get(":id/report")
  report(@CurrentAccountUser() user: AuthUser, @Param("id") id: string) {
    return this.solo.report(user, id);
  }

  @Patch(":id")
  update(
    @CurrentAccountUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateSoloTestDto,
  ) {
    return this.solo.update(user, id, dto);
  }

  @Delete(":id")
  remove(@CurrentAccountUser() user: AuthUser, @Param("id") id: string) {
    return this.solo.remove(user, id);
  }
}

/**
 * Playing a test: a guest player's own run through it. Only the public info
 * is rate limited by IP — a class on one school network plays the rest with
 * their own player tokens.
 */
@Controller("solo")
export class SoloPlayController {
  constructor(private readonly solo: SoloService) {}

  @Public()
  @UseGuards(RateLimitGuard)
  @Get(":code")
  info(@Param("code") code: string) {
    return this.solo.info(code);
  }

  @Post(":code/attempt")
  start(
    @CurrentPlayerUser() player: PlayerAuthUser,
    @Param("code") code: string,
  ) {
    return this.solo.start(player.playerId, code);
  }

  @Post("attempts/:id/next")
  next(@CurrentPlayerUser() player: PlayerAuthUser, @Param("id") id: string) {
    return this.solo.next(player.playerId, id);
  }

  @Post("attempts/:id/answer")
  answer(
    @CurrentPlayerUser() player: PlayerAuthUser,
    @Param("id") id: string,
    @Body() dto: SoloAnswerDto,
  ) {
    return this.solo.answer(player.playerId, id, dto.qIndex, dto.answer);
  }
}
