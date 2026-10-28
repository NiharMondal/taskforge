import { Access } from "@/common/decorators/access.decorator";
import { RequirePermission } from "@/common/decorators/require-permission.decorator";
import { WorkspaceId } from "@/common/decorators/workspaceId.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { WorkspaceGuard } from "@/common/guards/workspace.guard";
import type { WorkspaceAccess } from "@/common/permissions/workspace-access";
import { sendResponse } from "@/common/utils/send-response";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CreateRoleDto } from "./dto/create-role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RoleService } from "./role.service";

@Controller("roles")
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class RoleController {
  constructor(private roleService: RoleService) {}

  // Any member: the roster shows role names, and everyone may see what each grants.
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@WorkspaceId() workspaceId: string) {
    const roles = await this.roleService.findAll(workspaceId);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Roles fetched successfully",
      data: roles,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("role:manage")
  async create(
    @WorkspaceId() workspaceId: string,
    @Access() access: WorkspaceAccess,
    @Body() dto: CreateRoleDto,
  ) {
    const role = await this.roleService.create(workspaceId, access, dto);
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Role created",
      data: role,
    });
  }

  @Patch(":roleId")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("role:manage")
  async update(
    @WorkspaceId() workspaceId: string,
    @Param("roleId") roleId: string,
    @Access() access: WorkspaceAccess,
    @Body() dto: UpdateRoleDto,
  ) {
    const role = await this.roleService.update(
      workspaceId,
      roleId,
      access,
      dto,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Role updated",
      data: role,
    });
  }

  @Delete(":roleId")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("role:manage")
  async remove(
    @WorkspaceId() workspaceId: string,
    @Param("roleId") roleId: string,
    @Access() access: WorkspaceAccess,
  ) {
    const role = await this.roleService.remove(workspaceId, roleId, access);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Role deleted",
      data: role,
    });
  }
}
