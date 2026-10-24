import { EntitlementsService } from "../billing/entitlements.service";
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
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Express } from "express";
import { z } from "zod";
import {
  CurrentAccountUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator";
import type {
  AuthUser,
  JwtRequestUser,
} from "../../common/decorators/current-user.decorator";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { SoundSkinsService } from "./sound-skins.service";
import { isPlayerAuthUser } from "../../common/decorators/current-user.decorator";
import { soundSkinOptionsSchema } from "@buzrr/contract";

const createSchema = z.object({ name: z.string().max(60) });
const updateSchema = z.object({
  name: z.string().max(60).optional(),
  isGlobal: z.boolean().optional(),
  options: soundSkinOptionsSchema.optional(),
});

@Controller("sound-skins")
export class SoundSkinsController {
  constructor(
    private readonly skins: SoundSkinsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get()
  list(@CurrentAccountUser() user: AuthUser) {
    return this.skins.list(user);
  }

  /** The built-in skins' playback options (signed-in users and players). */
  @Get("builtin-options")
  builtinOptions(@CurrentUser() user: JwtRequestUser) {
    // Players' devices get the small copies of the files.
    return this.skins.builtinOptions(isPlayerAuthUser(user));
  }

  /** Superadmin: one built-in skin's options, for everyone. */
  @Put("builtin-options/:skinId")
  setBuiltinOptions(
    @CurrentAccountUser() user: AuthUser,
    @Param("skinId") skinId: string,
    @Body(new ZodValidationPipe(soundSkinOptionsSchema))
    body: z.infer<typeof soundSkinOptionsSchema>,
  ) {
    return this.skins.setBuiltinOptions(user, skinId, body);
  }

  /** Superadmin: a built-in skin's options back to its defaults. */
  @Post("builtin-options/:skinId/reset")
  resetBuiltinOptions(
    @CurrentAccountUser() user: AuthUser,
    @Param("skinId") skinId: string,
  ) {
    return this.skins.resetBuiltinOptions(user, skinId);
  }

  /** A built-in skin copied into the user's own skins. */
  @Post("builtin/:skinId/clone")
  async cloneBuiltin(
    @CurrentAccountUser() user: AuthUser,
    @Param("skinId") skinId: string,
    @Body(new ZodValidationPipe(createSchema))
    body: z.infer<typeof createSchema>,
  ) {
    await this.entitlements.assertPro(user.userId, "Your own audio skins");
    return this.skins.cloneBuiltin(user, skinId, body.name);
  }

  /**
   * A signed-in user (own, global or as admin), a player whose current game
   * uses this skin, or one playing a test of its owner ("Play alone"); the
   * files' links are signed for them.
   */
  @UseGuards(RateLimitGuard)
  @Get(":id")
  get(@CurrentUser() user: JwtRequestUser, @Param("id") id: string) {
    return this.skins.get(user, id);
  }

  @Post()
  async create(
    @CurrentAccountUser() user: AuthUser,
    @Body(new ZodValidationPipe(createSchema))
    body: z.infer<typeof createSchema>,
  ) {
    await this.entitlements.assertPro(user.userId, "Your own audio skins");
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
  async setSlot(
    @CurrentAccountUser() user: AuthUser,
    @Param("id") id: string,
    @Param("slot") slot: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.entitlements.assertPro(user.userId, "Your own audio skins");
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
