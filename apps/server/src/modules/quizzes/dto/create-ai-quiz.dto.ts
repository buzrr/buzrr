import { Type } from "class-transformer";
import { IsInt, IsString, Min } from "class-validator";

export class CreateAiQuizDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  questions!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  time!: number;
}
