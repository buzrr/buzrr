import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { SignAssetsInterceptor } from "./common/interceptors/sign-assets.interceptor";
import { AuthModule } from "./modules/auth/auth.module";
import { CommonModule } from "./common/common.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { AdminUsersModule } from "./modules/admin-users/admin-users.module";
import { BillingModule } from "./modules/billing/billing.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { GameSessionsModule } from "./modules/game-sessions/game-sessions.module";
import { HealthModule } from "./modules/health/health.module";
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
    HealthModule,
    PlayersModule,
    GameSessionsModule,
    QuizzesModule,
    QuestionsModule,
    ModerationModule,
    CategoriesModule,
    AdminUsersModule,
    BillingModule,
    DuelModule,
    UsersModule,
    RealtimeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Uploaded media links in responses are signed for authenticated callers.
    { provide: APP_INTERCEPTOR, useClass: SignAssetsInterceptor },
  ],
})
export class AppModule {}
