import { READ_TIME_OPTIONS } from "@buzrr/contract";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";

export class CreateRoomDto {
  @IsString()
  quizId!: string;

  /** Question-first reading time in seconds; 0 (the default) = together. */
  @IsOptional()
  @IsIn(READ_TIME_OPTIONS)
  readTimeSec?: (typeof READ_TIME_OPTIONS)[number];

  /** Players may send emoji reactions during results (default off). */
  @IsOptional()
  @IsBoolean()
  reactions?: boolean;
}
