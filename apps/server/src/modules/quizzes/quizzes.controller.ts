import { importQuizSchema, type ImportQuiz } from "@buzrr/contract";
import { FileInterceptor } from "@nestjs/platform-express";
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { CurrentAccountUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { RateLimitProfile } from "../../common/decorators/rate-limit-profile.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { z } from "zod";
import { CreateAiQuizDto } from "./dto/create-ai-quiz.dto";
import { CreateQuizDto } from "./dto/create-quiz.dto";
import { UpdateQuizDto } from "./dto/update-quiz.dto";
import { QuizzesService } from "./quizzes.service";

const changeOwnerSchema = z.object({
  email: z.string().trim().min(3).max(320),
});

@Controller("quizzes")
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  @Get()
  list(@CurrentAccountUser() user: AuthUser) {
    return this.quizzes.findAllForUser(user);
  }

  /** Admins: every user's quizzes, with their owner. */
  @Get("all")
  @UseGuards(RolesGuard)
  @Roles("admin", "superadmin")
  listAll() {
    return this.quizzes.findAll();
  }

  /** Admins: hand a quiz (and its questions) to another user, by email. */
  @Patch(":id/owner")
  @UseGuards(RolesGuard)
  @Roles("admin", "superadmin")
  changeOwner(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(changeOwnerSchema))
    body: z.infer<typeof changeOwnerSchema>,
  ) {
    return this.quizzes.changeOwner(id, body.email);
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

  /** Sets (file) or clears (no file) the quiz's logo. */
  @Post(":id/logo")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  setLogo(
    @CurrentAccountUser() user: AuthUser,
    @Param("id") id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.quizzes.setLogo(user, id, file ?? null);
  }

  /** A copy of the quiz with all its questions (not its past games). */
  @Post(":id/duplicate")
  duplicate(@CurrentAccountUser() user: AuthUser, @Param("id") id: string) {
    return this.quizzes.duplicate(user, id);
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
