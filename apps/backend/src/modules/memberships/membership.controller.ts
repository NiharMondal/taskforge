import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { WorkspaceId } from "@/common/decorators/workspaceId.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { WorkspaceGuard } from "@/common/guards/workspace.guard";
import type { JwtPayload } from "@/common/strategies/jwt.strategy";
import { sendResponse } from "@/common/utils/send-response";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common";
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
  async updateRole(
    @WorkspaceId() workspaceId: string,
    @Param("userId") userId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateRoleDto,
  ) {
    const member = await this.membershipService.updateRole(
      workspaceId,
      userId,
      user.sub,
      dto.role,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Role updated successfully",
      data: member,
    });
  }

  // remove member
  @Delete(":userId")
  async removeMember(
    @WorkspaceId() workspaceId: string,
    @Param("userId") userId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const member = await this.membershipService.removeMember(
      workspaceId,
      userId,
      user.sub,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Member removed successfully",
      data: member,
    });
  }
}
