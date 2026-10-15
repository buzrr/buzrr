import { Module } from "@nestjs/common";
import { CategoriesModule } from "../categories/categories.module";
import { ModerationModule } from "../moderation/moderation.module";
import { QuestionsController } from "./questions.controller";
import { QuestionsService } from "./questions.service";
import { QuizQuestionsController } from "./quiz-questions.controller";

@Module({
  imports: [ModerationModule, CategoriesModule],
  controllers: [QuestionsController, QuizQuestionsController],
  providers: [QuestionsService],
})
export class QuestionsModule {}
