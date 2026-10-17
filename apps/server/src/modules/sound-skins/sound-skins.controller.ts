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
import { FileInterceptor } from "@nestjs/platform-express";
import type { Express } from "express";
import { z } from "zod";
import { CurrentAccountUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { SoundSkinsService } from "./sound-skins.service";

const createSchema = z.object({ name: z.string().max(60) });
const updateSchema = z.object({
  name: z.string().max(60).optional(),
  isGlobal: z.boolean().optional(),
});

@Controller("sound-skins")
export class SoundSkinsController {
  constructor(private readonly skins: SoundSkinsService) {}

  @Get()
  list(@CurrentAccountUser() user: AuthUser) {
    return this.skins.list(user);
  }

  /** Public so players' devices can load the quiz's skin. */
  @Public()
  @UseGuards(RateLimitGuard)
  @Get(":id")
  get(@Param("id") id: string) {
    return this.skins.get(id);
  }

  @Post()
  create(
    @CurrentAccountUser() user: AuthUser,
    @Body(new ZodValidationPipe(createSchema))
    body: z.infer<typeof createSchema>,
  ) {
    return this.skins.create(user, body.name);
  }

  @Patch(":id")
  update(
    @CurrentAccountUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateSchema))
    body: z.infer<typeof updateSchema>,
  ) {
    return this.skins.update(user, id, body);
  }

  @Post(":id/slots/:slot")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  setSlot(
    @CurrentAccountUser() user: AuthUser,
    @Param("id") id: string,
    @Param("slot") slot: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.skins.setSlot(user, id, slot, file);
  }

  @Delete(":id/slots/:slot")
  clearSlot(
    @CurrentAccountUser() user: AuthUser,
    @Param("id") id: string,
    @Param("slot") slot: string,
  ) {
    return this.skins.clearSlot(user, id, slot);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentAccountUser() user: AuthUser, @Param("id") id: string) {
    return this.skins.remove(user, id);
  }
}
