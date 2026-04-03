import { IsOptional, IsString } from "class-validator";

export class CreateQuizDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
