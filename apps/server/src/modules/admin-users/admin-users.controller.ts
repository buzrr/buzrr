import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { CurrentAccountUser } from "../../common/decorators/current-user.decorator";
import type { AuthUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { AdminUsersService } from "./admin-users.service";
import { ListUsersDto } from "./dto/list-users.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";

@Controller("superadmin/users")
@UseGuards(RolesGuard)
@Roles("superadmin")
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  list(@Query() query: ListUsersDto) {
    return this.adminUsers.list(query);
  }

  @Patch(":id/role")
  @HttpCode(HttpStatus.NO_CONTENT)
  setRole(
    @CurrentAccountUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminUsers.setRole(user.userId, id, dto.role);
  }
}
