import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  setQuestionCategoriesSchema,
  type SetQuestionCategories,
} from "@buzrr/contract";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { ListModerationQueueDto } from "./dto/list-moderation-queue.dto";
import { ModerationService } from "./moderation.service";

@Controller("moderation/questions")
@UseGuards(RolesGuard)
@Roles("admin", "superadmin")
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get()
  list(@Query() query: ListModerationQueueDto) {
    return this.moderation.listQueue(query);
  }

  @Patch(":id/approve")
  @HttpCode(HttpStatus.NO_CONTENT)
  approve(@Param("id") id: string) {
    return this.moderation.approve(id);
  }

  @Patch(":id/unapprove")
  @HttpCode(HttpStatus.NO_CONTENT)
  unapprove(@Param("id") id: string) {
    return this.moderation.unapprove(id);
  }

  @Patch(":id/categories")
  @HttpCode(HttpStatus.NO_CONTENT)
  setCategories(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(setQuestionCategoriesSchema))
    body: SetQuestionCategories,
  ) {
    return this.moderation.setCategories(id, body.categoryIds);
  }
}
