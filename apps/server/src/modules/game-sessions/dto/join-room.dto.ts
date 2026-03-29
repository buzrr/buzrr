import { IsString } from "class-validator";

export class JoinRoomDto {
  @IsString()
  gameCode!: string;

  @IsString()
  playerId!: string;
}
