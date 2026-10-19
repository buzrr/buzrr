import { IsBoolean, IsISO8601, IsOptional, IsString } from "class-validator";

export class CreateSoloTestDto {
  @IsString()
  quizId!: string;

  /** No new answers after this (ISO time); left out = open until closed. */
  @IsOptional()
  @IsISO8601()
  closesAt?: string;

  /** The host trying the quiz alone: not listed, nothing reported. */
  @IsOptional()
  @IsBoolean()
  practice?: boolean;
}
