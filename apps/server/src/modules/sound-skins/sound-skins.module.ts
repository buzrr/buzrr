import { Module } from "@nestjs/common";
import { SoundSkinsController } from "./sound-skins.controller";
import { SoundSkinsService } from "./sound-skins.service";

@Module({
  controllers: [SoundSkinsController],
  providers: [SoundSkinsService],
})
export class SoundSkinsModule {}
