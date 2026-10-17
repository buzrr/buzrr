import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import type { Express } from "express";
import { CurrentAccountUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { QuestionsService } from "./questions.service";

@Controller("quizzes")
export class QuizQuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get(":quizId/questions")
  list(@CurrentAccountUser() user: AuthUser, @Param("quizId") quizId: string) {
    return this.questions.findAllForQuiz(user, quizId);
  }

  @Post(":quizId/questions")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "file", maxCount: 1 },
        { name: "audio", maxCount: 1 },
      ],
      { limits: { fileSize: 20 * 1024 * 1024 } },
    ),
  )
  upsert(
    @CurrentAccountUser() user: AuthUser,
    @Param("quizId") quizId: string,
    @Body() body: Record<string, string>,
    @UploadedFiles()
    files?: { file?: Express.Multer.File[]; audio?: Express.Multer.File[] },
  ) {
    return this.questions.upsertFromMultipart(
      user,
      quizId,
      body,
      files?.file?.[0],
      files?.audio?.[0],
    );
  }
}
