import { Module } from "@nestjs/common";
import { DuelBotService } from "./duel-bot.service";
import { GameEngineService } from "./game-engine.service";
import { GameStoreService } from "./game-store.service";

@Module({
  providers: [GameEngineService, GameStoreService, DuelBotService],
  exports: [GameEngineService, GameStoreService],
})
export class GameEngineModule {}
