import { Access } from "@/common/decorators/access.decorator";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Public } from "@/common/decorators/public.decorator";
import { RequirePermission } from "@/common/decorators/require-permission.decorator";
import { WorkspaceId } from "@/common/decorators/workspaceId.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { WorkspaceGuard } from "@/common/guards/workspace.guard";
import type { WorkspaceAccess } from "@/common/permissions/workspace-access";
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
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import { SendInvitationDto } from "./dto/send-invitation.dto";
import { ValidateInvitationQueryDto } from "./dto/validate-invitation.dto";
import { InvitationService } from "./invitation.service";

@Controller("invitations")
export class InvitationController {
  constructor(private invitationService: InvitationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("invitation:manage")
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  async sendInvitation(
    @WorkspaceId() workspaceId: string,
    @Access() access: WorkspaceAccess,
    @Body() dto: SendInvitationDto,
  ) {
    const invitation = await this.invitationService.sendInvitation(
      workspaceId,
      access,
      dto,
    );
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Invitation sent successfully",
      data: invitation,
    });
  }

  @Get()
  @RequirePermission("invitation:manage")
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  async listInvitations(@WorkspaceId() workspaceId: string) {
    const invitations =
      await this.invitationService.listInvitations(workspaceId);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Invitations fetched successfully",
      data: invitations,
    });
  }

  @Get("validate")
  @Public()
  async validateToken(@Query() query: ValidateInvitationQueryDto) {
    const data = await this.invitationService.validateToken(query.token);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Invitation is valid",
      data,
    });
  }

  @Post("accept")
  async acceptInvitation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AcceptInvitationDto,
  ) {
    const result = await this.invitationService.acceptInvitation(
      dto.token,
      user.sub,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Invitation accepted successfully",
      data: result,
    });
  }

  @Delete(":id")
  @RequirePermission("invitation:manage")
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  async revokeInvitation(
    @WorkspaceId() workspaceId: string,
    @Param("id") invitationId: string,
  ) {
    const invitation = await this.invitationService.revokeInvitation(
      workspaceId,
      invitationId,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Invitation revoked successfully",
      data: invitation,
    });
  }
}
