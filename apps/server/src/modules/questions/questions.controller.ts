import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
} from "@nestjs/common";
import { CurrentAccountUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { ReorderQuestionsDto } from "./dto/reorder-questions.dto";
import { QuestionsService } from "./questions.service";

@Controller("questions")
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Patch("reorder")
  reorder(@CurrentAccountUser() user: AuthUser, @Body() dto: ReorderQuestionsDto) {
    return this.questions.reorder(user, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentAccountUser() user: AuthUser, @Param("id") id: string) {
    return this.questions.delete(user, id);
  }
}
