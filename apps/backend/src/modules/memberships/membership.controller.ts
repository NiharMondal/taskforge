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
import { TransferOwnershipDto } from "./dto/transfer-ownership.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { MembershipService } from "./membership.service";

@Controller("memberships")
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class MembershipController {
  constructor(private membershipService: MembershipService) {}

  // find all members of a workspace
  @Get()
  async findAllByWorkspaceId(@WorkspaceId() workspaceId: string) {
    const members =
      await this.membershipService.findAllByWorkspaceId(workspaceId);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Members fetched successfully",
      data: members,
    });
  }

  // The caller's own role and permissions. Declared before `:userId` so "me"
  // isn't taken for a user id.
  @Get("me")
  async getMine(@Access() access: WorkspaceAccess) {
    const membership = await this.membershipService.getMine(access);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Membership fetched successfully",
      data: membership,
    });
  }

  // Hand the workspace to another member (the OWNER only).
  @Post("transfer-ownership")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("workspace:transfer")
  async transferOwnership(
    @WorkspaceId() workspaceId: string,
    @Access() access: WorkspaceAccess,
    @Body() dto: TransferOwnershipDto,
  ) {
    const member = await this.membershipService.transferOwnership(
      workspaceId,
      access,
      dto.userId,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Ownership transferred",
      data: member,
    });
  }

  // Leave the workspace yourself. Declared before `:userId`, like `GET me`.
  @Delete("me")
  async leave(@Access() access: WorkspaceAccess) {
    const membership = await this.membershipService.leave(access);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "You left the workspace",
      data: membership,
    });
  }

  // Get single member
  @Get(":userId")
  async findOne(
    @WorkspaceId() workspaceId: string,
    @Param("userId") userId: string,
  ) {
    const member = await this.membershipService.findOne(workspaceId, userId);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Member fetched successfully",
      data: member,
    });
  }

  // update member role
  @Patch(":userId")
  @RequirePermission("member:manage")
  async updateRole(
    @WorkspaceId() workspaceId: string,
    @Param("userId") userId: string,
    @Access() access: WorkspaceAccess,
    @Body() dto: UpdateRoleDto,
  ) {
    const member = await this.membershipService.updateRole(
      workspaceId,
      userId,
      access,
      dto,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Role updated successfully",
      data: member,
    });
  }

  // remove member
  @Delete(":userId")
  @RequirePermission("member:manage")
  async removeMember(
    @WorkspaceId() workspaceId: string,
    @Param("userId") userId: string,
    @Access() access: WorkspaceAccess,
  ) {
    const member = await this.membershipService.removeMember(
      workspaceId,
      userId,
      access,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Member removed successfully",
      data: member,
    });
  }
}
