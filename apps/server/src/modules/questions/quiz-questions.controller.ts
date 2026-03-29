import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Express } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { QuestionsService } from "./questions.service";

@Controller("quizzes")
export class QuizQuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get(":quizId/questions")
  list(@CurrentUser() user: AuthUser, @Param("quizId") quizId: string) {
    return this.questions.findAllForQuiz(user, quizId);
  }

  @Post(":quizId/questions")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(FileInterceptor("file"))
  upsert(
    @CurrentUser() user: AuthUser,
    @Param("quizId") quizId: string,
    @Body() body: Record<string, string>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.questions.upsertFromMultipart(user, quizId, body, file);
  }
}
