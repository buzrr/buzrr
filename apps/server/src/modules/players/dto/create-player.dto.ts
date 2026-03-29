import { IsString } from "class-validator";

export class CreatePlayerDto {
  @IsString()
  username!: string;

  @IsString()
  profile!: string;
}
