import { Matches } from "class-validator";
import { DUEL_CODE_PATTERN } from "../duel-code";

export class InviteCodeParamDto {
  @Matches(DUEL_CODE_PATTERN, { message: "Invalid invite code" })
  code!: string;
}
