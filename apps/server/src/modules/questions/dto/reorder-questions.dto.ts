import { IsString } from "class-validator";

export class ReorderQuestionsDto {
  @IsString()
  dragQuesId!: string;

  @IsString()
  dropQuesId!: string;
}
