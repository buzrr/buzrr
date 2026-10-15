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
  UseGuards,
} from "@nestjs/common";
import { upsertCategorySchema, type UpsertCategory } from "@buzrr/contract";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { CategoriesService } from "./categories.service";

/**
 * Every category (for tagging questions) is readable by any signed-in user;
 * changing them is admin-only. Players pick duel categories from
 * `GET /duel/categories`, which only lists playable ones.
 */
@Controller("categories")
@UseGuards(RolesGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.list();
  }

  @Post()
  @Roles("admin", "superadmin")
  create(
    @Body(new ZodValidationPipe(upsertCategorySchema)) body: UpsertCategory,
  ) {
    return this.categories.create(body);
  }

  @Patch(":id")
  @Roles("admin", "superadmin")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(upsertCategorySchema)) body: UpsertCategory,
  ) {
    return this.categories.update(id, body);
  }

  @Delete(":id")
  @Roles("admin", "superadmin")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string) {
    return this.categories.remove(id);
  }
}
