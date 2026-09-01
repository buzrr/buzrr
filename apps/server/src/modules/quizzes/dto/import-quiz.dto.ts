import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

export class ImportOptionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

export class ImportQuestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  title!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  timeOut?: number;

  // 2 allows True/False; 6 is a sane upper bound. The authoring form
  // (`AddQuesForm`) still assumes exactly 4 — see the note in
  // `QuizzesService.importQuestions`.
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ImportOptionDto)
  options!: ImportOptionDto[];
}

/**
 * Batch import of externally generated questions (Buzrr-AI Knowledge Spaces).
 *
 * Deliberately JSON rather than the multipart shape `POST /quizzes/:id/questions`
 * uses: there is no media on generated questions, and the whole set must land in
 * one transaction rather than N round-trips.
 */
export class ImportQuizDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ImportQuestionDto)
  questions!: ImportQuestionDto[];
}
