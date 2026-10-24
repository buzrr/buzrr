import { IsISO8601, IsOptional, ValidateIf } from "class-validator";

export class UpdateSoloTestDto {
  /** A new deadline (ISO time), "now" to close it, or null to reopen. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== "now")
  @IsISO8601()
  closesAt?: string | null;
}
