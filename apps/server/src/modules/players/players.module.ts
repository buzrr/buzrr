import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PlayersController } from "./players.controller";
import { PlayersService } from "./players.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("NEXTAUTH_SECRET"),
        signOptions: { expiresIn: "7d" },
      }),
    }),
  ],
  controllers: [PlayersController],
  providers: [PlayersService],
})
export class PlayersModule {}
