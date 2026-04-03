import { Module } from "@nestjs/common";
import { QuestionsController } from "./questions.controller";
import { QuestionsService } from "./questions.service";
import { QuizQuestionsController } from "./quiz-questions.controller";

@Module({
  controllers: [QuestionsController, QuizQuestionsController],
  providers: [QuestionsService],
})
export class QuestionsModule {}
