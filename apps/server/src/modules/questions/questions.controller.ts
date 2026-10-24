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
import {
  createStandaloneQuestionsSchema,
  type CreateStandaloneQuestions,
} from "@buzrr/contract";
import { z } from "zod";
import { CurrentAccountUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { RateLimitProfile } from "../../common/decorators/rate-limit-profile.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ModerationService } from "../moderation/moderation.service";
import { ReorderQuestionsDto } from "./dto/reorder-questions.dto";
import { QuestionsService } from "./questions.service";

const setDisabledSchema = z.object({ disabled: z.boolean() });

@Controller("questions")
export class QuestionsController {
  constructor(
    private readonly questions: QuestionsService,
    private readonly moderation: ModerationService,
  ) {}

  /**
   * Standalone questions (no quiz) for the duel pool. Admin-only: plan limits
   * are counted per quiz, so open creation would bypass them.
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles("admin", "superadmin")
  createStandalone(
    @CurrentAccountUser() user: AuthUser,
    @Body(new ZodValidationPipe(createStandaloneQuestionsSchema))
    body: CreateStandaloneQuestions,
  ) {
    return this.questions.createStandalone(user, body);
  }

  @Patch("reorder")
  reorder(
    @CurrentAccountUser() user: AuthUser,
    @Body() dto: ReorderQuestionsDto,
  ) {
    return this.questions.reorder(user, dto);
  }

  @Patch(":id/disabled")
  setDisabled(
    @CurrentAccountUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(setDisabledSchema))
    body: z.infer<typeof setDisabledSchema>,
  ) {
    return this.questions.setDisabled(user, id, body.disabled);
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
