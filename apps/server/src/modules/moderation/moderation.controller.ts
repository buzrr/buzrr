import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
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
}
