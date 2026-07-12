import { Module } from "@nestjs/common";
import { GameEngineService } from "./game-engine.service";
import { GameStoreService } from "./game-store.service";

@Module({
  providers: [GameEngineService, GameStoreService],
  exports: [GameEngineService, GameStoreService],
})
export class GameEngineModule {}
