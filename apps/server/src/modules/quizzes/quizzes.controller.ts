import { importQuizSchema, type ImportQuiz } from "@buzrr/contract";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentAccountUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { RateLimitProfile } from "../../common/decorators/rate-limit-profile.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CreateAiQuizDto } from "./dto/create-ai-quiz.dto";
import { CreateQuizDto } from "./dto/create-quiz.dto";
import { UpdateQuizDto } from "./dto/update-quiz.dto";
import { QuizzesService } from "./quizzes.service";

@Controller("quizzes")
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Get()
  list(
    @CurrentAccountUser() user: AuthUser,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    const take = Math.min(Math.max(parseInt(limit ?? "", 10) || 10, 1), 50);
    return this.quizzes.findPageForUser(user, { cursor, limit: take });
  }

  @Get(":id")
  findOne(@CurrentAccountUser() user: AuthUser, @Param("id") id: string) {
    return this.quizzes.findOneForUser(user, id);
  }

  @Post()
  create(@CurrentAccountUser() user: AuthUser, @Body() dto: CreateQuizDto) {
    return this.quizzes.create(user, dto);
  }

  @Post("ai")
  @UseGuards(RateLimitGuard)
  @RateLimitProfile("ai")
  createAi(@CurrentAccountUser() user: AuthUser, @Body() dto: CreateAiQuizDto) {
    return this.quizzes.createWithAi(user, dto);
  }

  @Post("import")
  @UseGuards(RateLimitGuard)
  importQuiz(
    @CurrentAccountUser() user: AuthUser,
    @Body(new ZodValidationPipe(importQuizSchema)) body: ImportQuiz,
  ) {
    return this.quizzes.importQuestions(user, body);
  }

  @Patch(":id")
  update(
    @CurrentAccountUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateQuizDto,
  ) {
    return this.quizzes.update(user, id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentAccountUser() user: AuthUser, @Param("id") id: string) {
    return this.quizzes.delete(user, id);
  }
}
