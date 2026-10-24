import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PlayersController } from "./players.controller";
import { PlayersService } from "./players.service";
import { PlayerCleanupService } from "./player-cleanup.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("BETTER_AUTH_SECRET"),
        signOptions: { expiresIn: "7d" },
      }),
    }),
  ],
  controllers: [PlayersController],
  providers: [PlayersService, PlayerCleanupService],
})
export class PlayersModule {}
