import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

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

  /** The language to write the quiz in (the host's UI language). */
  @IsOptional()
  @IsIn(["English", "German"])
  language?: string;
}
