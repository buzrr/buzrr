import { Module } from "@nestjs/common";
import { GameEngineModule } from "../game-engine/game-engine.module";
import { DuelController } from "./duel.controller";
import { MatchmakingService } from "./matchmaking.service";

@Module({
  imports: [GameEngineModule],
  controllers: [DuelController],
  providers: [MatchmakingService],
  exports: [MatchmakingService],
})
export class DuelModule {}
