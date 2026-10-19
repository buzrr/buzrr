import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

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

  /** How hard the questions are: 1 (easy) to 5 (hard); 3 when left out. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  /** The language to write the quiz in (the host's UI language). */
  @IsOptional()
  @IsIn(["English", "German"])
  language?: string;
}
