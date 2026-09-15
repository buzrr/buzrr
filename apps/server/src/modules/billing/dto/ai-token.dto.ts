import { IsIn, IsString, Length } from "class-validator";

export class ReserveAiTokenDto {
  /**
   * Only the Buzrr-AI service reserves over HTTP; the Nest quiz generator
   * reserves in-process, so `quiz_ai` isn't accepted here.
   */
  @IsIn(["rag"])
  source!: "rag";
}

export class ReleaseAiTokenDto {
  @IsString()
  @Length(1, 64)
  reservationId!: string;

  @IsString()
  @Length(1, 128)
  releaseToken!: string;
}
