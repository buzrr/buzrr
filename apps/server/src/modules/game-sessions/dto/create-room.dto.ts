import { IsString } from "class-validator";

export class CreateRoomDto {
  @IsString()
  quizId!: string;
}
