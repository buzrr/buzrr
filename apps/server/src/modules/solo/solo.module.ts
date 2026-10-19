import { Module } from "@nestjs/common";
import { SoloPlayController, SoloTestsController } from "./solo.controller";
import { SoloService } from "./solo.service";

@Module({
  controllers: [SoloTestsController, SoloPlayController],
  providers: [SoloService],
})
export class SoloModule {}
