import { Matches } from "class-validator";
import { DUEL_INVITE_CODE_PATTERN } from "../duel-code";

export class InviteCodeParamDto {
  @Matches(DUEL_INVITE_CODE_PATTERN, { message: "Invalid invite code" })
  code!: string;
}
