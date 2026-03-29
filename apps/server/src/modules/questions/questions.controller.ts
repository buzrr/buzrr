import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { ReorderQuestionsDto } from "./dto/reorder-questions.dto";
import { QuestionsService } from "./questions.service";

@Controller("questions")
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Patch("reorder")
  reorder(@CurrentUser() user: AuthUser, @Body() dto: ReorderQuestionsDto) {
    return this.questions.reorder(user, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.questions.delete(user, id);
  }
}
