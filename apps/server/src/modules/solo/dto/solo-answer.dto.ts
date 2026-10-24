import { IsDefined, IsInt, Min } from "class-validator";

export class SoloAnswerDto {
  @IsInt()
  @Min(0)
  qIndex!: number;

  /** Checked by the question's type (like `submit-answer`). */
  @IsDefined()
  answer!: unknown;
}
