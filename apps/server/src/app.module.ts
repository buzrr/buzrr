import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./modules/auth/auth.module";
import { CommonModule } from "./common/common.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { AdminUsersModule } from "./modules/admin-users/admin-users.module";
import { GameSessionsModule } from "./modules/game-sessions/game-sessions.module";
import { ModerationModule } from "./modules/moderation/moderation.module";
import { PlayersModule } from "./modules/players/players.module";
import { PrismaModule } from "./prisma/prisma.module";
import { QuestionsModule } from "./modules/questions/questions.module";
import { DuelModule } from "./modules/duel/duel.module";
import { QuizzesModule } from "./modules/quizzes/quizzes.module";
import { UsersModule } from "./modules/users/users.module";
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
    ModerationModule,
    AdminUsersModule,
    DuelModule,
    UsersModule,
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
