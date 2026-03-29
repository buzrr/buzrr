import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { RateLimitProfile } from "../../common/decorators/rate-limit-profile.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { CreateAiQuizDto } from "./dto/create-ai-quiz.dto";
import { CreateQuizDto } from "./dto/create-quiz.dto";
import { QuizzesService } from "./quizzes.service";

@Controller("quizzes")
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateQuizDto) {
    return this.quizzes.create(user, dto);
  }

  @Post("ai")
  @UseGuards(RateLimitGuard)
  @RateLimitProfile("ai")
  createAi(@CurrentUser() user: AuthUser, @Body() dto: CreateAiQuizDto) {
    return this.quizzes.createWithAi(user, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.quizzes.delete(user, id);
  }
}
