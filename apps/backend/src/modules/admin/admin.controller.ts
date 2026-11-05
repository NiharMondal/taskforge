/**
 * PLATFORM ADMIN — THE ONE DELIBERATE CROSS-TENANT EXCEPTION.
 *
 * Every other route reads and writes inside one workspace, proven by
 * WorkspaceGuard from the `x-workspace-id` header. These read every workspace
 * and account, for the people who run the product (`spec/admin-spec.md`).
 * They take no `x-workspace-id` (it is ignored if sent) and use no
 * WorkspaceGuard: the boundary is the caller's `User.platformRole`, read from
 * the database on every request by PlatformRoleGuard. Keep cross-tenant reads
 * in this module, behind `@RequirePlatformRole`, and nowhere else.
 */
import { RequirePlatformRole } from "@/common/decorators/require-platform-role.decorator";
import { sendResponse } from "@/common/utils/send-response";
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from "@nestjs/common";
import { PlatformRole } from "generated/prisma/enums";
import { AdminService } from "./admin.service";
import {
  QueryAdminUsersDto,
  QueryAdminWorkspacesDto,
} from "./dto/admin-query.dto";

/** Read-only, so SUPPORT (and ADMIN) may use every route here. */
@Controller("admin")
@RequirePlatformRole(PlatformRole.SUPPORT)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("stats")
  @HttpCode(HttpStatus.OK)
  async stats() {
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Platform stats fetched successfully",
      data: await this.admin.stats(),
    });
  }

  @Get("workspaces")
  @HttpCode(HttpStatus.OK)
  async findWorkspaces(@Query() query: QueryAdminWorkspacesDto) {
    const { data, metaData } = await this.admin.findWorkspaces(query);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Workspaces fetched successfully",
      metaData,
      data,
    });
  }

  @Get("workspaces/:id")
  @HttpCode(HttpStatus.OK)
  async findWorkspace(@Param("id") id: string) {
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Workspace fetched successfully",
      data: await this.admin.findWorkspace(id),
    });
  }

  @Get("users")
  @HttpCode(HttpStatus.OK)
  async findUsers(@Query() query: QueryAdminUsersDto) {
    const { data, metaData } = await this.admin.findUsers(query);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Users fetched successfully",
      metaData,
      data,
    });
  }

  @Get("users/:id")
  @HttpCode(HttpStatus.OK)
  async findUser(@Param("id") id: string) {
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "User fetched successfully",
      data: await this.admin.findUser(id),
    });
  }
}
