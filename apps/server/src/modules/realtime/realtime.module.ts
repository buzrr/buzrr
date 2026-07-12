import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { DuelModule } from "../duel/duel.module";
import { GameEngineModule } from "../game-engine/game-engine.module";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeService } from "./realtime.service";

@Module({
  imports: [
    GameEngineModule,
    DuelModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("BETTER_AUTH_SECRET"),
      }),
    }),
  ],
  providers: [RealtimeGateway, RealtimeService],
})
export class RealtimeModule {}
