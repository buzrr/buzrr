import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./modules/auth/auth.module";
import { CommonModule } from "./common/common.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { GameSessionsModule } from "./modules/game-sessions/game-sessions.module";
import { PlayersModule } from "./modules/players/players.module";
import { PrismaModule } from "./prisma/prisma.module";
import { QuestionsModule } from "./modules/questions/questions.module";
import { DuelModule } from "./modules/duel/duel.module";
import { QuizzesModule } from "./modules/quizzes/quizzes.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { RedisModule } from "./redis/redis.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisModule,
    CommonModule,
    PrismaModule,
    AuthModule,
    PlayersModule,
    GameSessionsModule,
    QuizzesModule,
    QuestionsModule,
    DuelModule,
    RealtimeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
