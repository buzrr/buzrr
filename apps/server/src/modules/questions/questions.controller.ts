import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentAccountUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { RateLimitProfile } from "../../common/decorators/rate-limit-profile.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { ModerationService } from "../moderation/moderation.service";
import { ReorderQuestionsDto } from "./dto/reorder-questions.dto";
import { QuestionsService } from "./questions.service";

@Controller("questions")
export class QuestionsController {
  constructor(
    private readonly questions: QuestionsService,
    private readonly moderation: ModerationService,
  ) {}

  @Patch("reorder")
  reorder(@CurrentAccountUser() user: AuthUser, @Body() dto: ReorderQuestionsDto) {
    return this.questions.reorder(user, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentAccountUser() user: AuthUser, @Param("id") id: string) {
    return this.questions.delete(user, id);
  }

  @Post(":id/report")
  @UseGuards(RateLimitGuard)
  @RateLimitProfile("report")
  @HttpCode(HttpStatus.NO_CONTENT)
  report(@CurrentAccountUser() user: AuthUser, @Param("id") id: string) {
    return this.moderation.reportQuestion(id, user.userId);
  }
}
