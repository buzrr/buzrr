import { Module } from "@nestjs/common";
import { GameEngineModule } from "../game-engine/game-engine.module";
import { DuelController } from "./duel.controller";
import { DuelInviteService } from "./duel-invite.service";
import { DuelQuestionsService } from "./duel-questions.service";
import { MatchmakingService } from "./matchmaking.service";

@Module({
  imports: [GameEngineModule],
  controllers: [DuelController],
  providers: [DuelQuestionsService, DuelInviteService, MatchmakingService],
  exports: [DuelInviteService, MatchmakingService],
})
export class DuelModule {}
