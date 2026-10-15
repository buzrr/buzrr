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
  bulkModerationSchema,
  bulkSetCategoriesSchema,
  setQuestionCategoriesSchema,
  type BulkModeration,
  type BulkSetCategories,
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

  @Get("counts")
  counts() {
    return this.moderation.counts();
  }

  // Bulk routes are one segment shorter than the `:id/...` ones, so they
  // never match an id.
  @Patch("approve")
  bulkApprove(
    @Body(new ZodValidationPipe(bulkModerationSchema)) body: BulkModeration,
  ) {
    return this.moderation.bulkApprove(body.ids);
  }

  @Patch("unapprove")
  bulkUnapprove(
    @Body(new ZodValidationPipe(bulkModerationSchema)) body: BulkModeration,
  ) {
    return this.moderation.bulkUnapprove(body.ids);
  }

  @Patch("pending")
  bulkMoveToPending(
    @Body(new ZodValidationPipe(bulkModerationSchema)) body: BulkModeration,
  ) {
    return this.moderation.bulkMoveToPending(body.ids);
  }

  @Patch("categories")
  bulkSetCategories(
    @Body(new ZodValidationPipe(bulkSetCategoriesSchema))
    body: BulkSetCategories,
  ) {
    return this.moderation.bulkSetCategories(body);
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

  @Patch(":id/pending")
  @HttpCode(HttpStatus.NO_CONTENT)
  moveToPending(@Param("id") id: string) {
    return this.moderation.moveToPending(id);
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
