import { IsNumber, IsString } from "class-validator";

export class SubmitAnswerDto {
  @IsString()
  playerId!: string;

  @IsString()
  optionId!: string;

  @IsNumber()
  timeTaken!: number;
}
