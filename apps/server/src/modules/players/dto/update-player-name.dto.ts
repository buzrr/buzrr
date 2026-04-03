import { IsString } from "class-validator";

export class UpdatePlayerNameDto {
  @IsString()
  playerId!: string;

  @IsString()
  username!: string;
}
