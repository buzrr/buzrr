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

  /** How many multiple-choice questions: 0 none, 1 few, 2 some, 3 many (default). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  multipleChoice?: number;

  /** How many true / false statements: 0–3 (default 1, few). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  trueFalse?: number;

  /** How many type-the-answer questions: 0–3 (default 1, few). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  typeAnswer?: number;

  /** The language to write the quiz in (the host's UI language). */
  @IsOptional()
  @IsIn(["English", "German"])
  language?: string;
}
