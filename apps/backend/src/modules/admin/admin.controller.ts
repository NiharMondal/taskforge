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
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { RequirePlatformRole } from "@/common/decorators/require-platform-role.decorator";
import type { JwtPayload } from "@/common/strategies/jwt.strategy";
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
  Query,
} from "@nestjs/common";
import { PlatformRole } from "generated/prisma/enums";
import { AdminActionsService } from "./admin-actions.service";
import { AdminService } from "./admin.service";
import {
  AdminReasonDto,
  QueryPlatformAuditLogDto,
  SetSuspendedDto,
} from "./dto/admin-action.dto";
import {
  QueryAdminUsersDto,
  QueryAdminWorkspacesDto,
} from "./dto/admin-query.dto";

/**
 * SUPPORT (and ADMIN) may read; every write, and the audit log, is
 * `@RequirePlatformRole(ADMIN)` on its route, which overrides the class's.
 */
@Controller("admin")
@RequirePlatformRole(PlatformRole.SUPPORT)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly actions: AdminActionsService,
  ) {}

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

  // ---- ADMIN only ----

  /** Suspend the account, or lift it (`{ suspended, reason }`). */
  @Patch("users/:id")
  @HttpCode(HttpStatus.OK)
  @RequirePlatformRole(PlatformRole.ADMIN)
  async setUserSuspended(
    @CurrentUser() actor: JwtPayload,
    @Param("id") id: string,
    @Body() dto: SetSuspendedDto,
  ) {
    await this.actions.setUserSuspended(actor.sub, id, dto);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: dto.suspended ? "User suspended" : "Suspension lifted",
      data: await this.admin.findUser(id),
    });
  }

  @Post("users/:id/revoke-sessions")
  @HttpCode(HttpStatus.OK)
  @RequirePlatformRole(PlatformRole.ADMIN)
  async revokeSessions(
    @CurrentUser() actor: JwtPayload,
    @Param("id") id: string,
    @Body() dto: AdminReasonDto,
  ) {
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Sessions revoked",
      data: await this.actions.revokeSessions(actor.sub, id, dto),
    });
  }

  @Delete("users/:id")
  @HttpCode(HttpStatus.OK)
  @RequirePlatformRole(PlatformRole.ADMIN)
  async deleteUser(
    @CurrentUser() actor: JwtPayload,
    @Param("id") id: string,
    @Body() dto: AdminReasonDto,
  ) {
    await this.actions.deleteUser(actor.sub, id, dto);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "User deleted",
      data: null,
    });
  }

  /** Suspend the workspace, or lift it (`{ suspended, reason }`). */
  @Patch("workspaces/:id")
  @HttpCode(HttpStatus.OK)
  @RequirePlatformRole(PlatformRole.ADMIN)
  async setWorkspaceSuspended(
    @CurrentUser() actor: JwtPayload,
    @Param("id") id: string,
    @Body() dto: SetSuspendedDto,
  ) {
    await this.actions.setWorkspaceSuspended(actor.sub, id, dto);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: dto.suspended ? "Workspace suspended" : "Suspension lifted",
      data: await this.admin.findWorkspace(id),
    });
  }

  @Delete("workspaces/:id")
  @HttpCode(HttpStatus.OK)
  @RequirePlatformRole(PlatformRole.ADMIN)
  async deleteWorkspace(
    @CurrentUser() actor: JwtPayload,
    @Param("id") id: string,
    @Body() dto: AdminReasonDto,
  ) {
    await this.actions.deleteWorkspace(actor.sub, id, dto);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Workspace deleted",
      data: null,
    });
  }

  @Get("audit-log")
  @HttpCode(HttpStatus.OK)
  @RequirePlatformRole(PlatformRole.ADMIN)
  async auditLog(@Query() query: QueryPlatformAuditLogDto) {
    const { data, metaData } = await this.actions.auditLog(query);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Platform audit log fetched successfully",
      metaData,
      data,
    });
  }
}
