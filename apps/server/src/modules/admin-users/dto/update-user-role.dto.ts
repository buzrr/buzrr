import { IsIn } from "class-validator";

export class UpdateUserRoleDto {
  /** Superadmin is deliberately excluded -- that role can't be granted via this endpoint. */
  @IsIn(["admin", "user"])
  role!: "admin" | "user";
}
