import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module";
import { CategoriesModule } from "../categories/categories.module";
import { QuizzesController } from "./quizzes.controller";
import { QuizzesService } from "./quizzes.service";

@Module({
  imports: [BillingModule, CategoriesModule],
  controllers: [QuizzesController],
  providers: [QuizzesService],
})
export class QuizzesModule {}
