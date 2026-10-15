import {
  MODERATION_LIST_STATUSES,
  type ModerationListStatus,
} from "@buzrr/contract";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListModerationQueueDto {
  @IsOptional()
  @IsIn(MODERATION_LIST_STATUSES)
  status?: ModerationListStatus;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
