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
  Post,
  UseGuards,
} from "@nestjs/common";
import { AcceptInvitationDto } from "./dto/accept-invitation.dto";
import { SendInvitationDto } from "./dto/send-invitation.dto";
import { InvitationService } from "./invitation.service";

@Controller("invitations")
export class InvitationController {
  constructor(private invitationService: InvitationService) {}

  @Post()
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  async sendInvitation(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: SendInvitationDto,
  ) {
    const invitation = await this.invitationService.sendInvitation(
      workspaceId,
      user.sub,
      dto,
    );
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Invitation sent successfully",
      data: invitation,
    });
  }

  @Get()
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

  @Delete(":id")
  @UseGuards(JwtAuthGuard, WorkspaceGuard)
  async cancelInvitation(
    @WorkspaceId() workspaceId: string,
    @Param("id") invitationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const invitation = await this.invitationService.cancelInvitation(
      workspaceId,
      invitationId,
      user.sub,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Invitation cancelled successfully",
      data: invitation,
    });
  }

  @Post("accept")
  async acceptInvitation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AcceptInvitationDto,
  ) {
    const membership = await this.invitationService.acceptInvitation(
      dto.token,
      user.sub,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Invitation accepted successfully",
      data: membership,
    });
  }
}
