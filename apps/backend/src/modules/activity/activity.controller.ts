import { WorkspaceId } from "@/common/decorators/workspaceId.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { WorkspaceGuard } from "@/common/guards/workspace.guard";
import { sendResponse } from "@/common/utils/send-response";
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  UseGuards,
} from "@nestjs/common";
import { ActivityService } from "./activity.service";

@Controller("projects/:projectId/issues/:issueId/activity")
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  /** Any member who can read the issue can read its history. */
  @Get()
  @HttpCode(HttpStatus.OK)
  async findForIssue(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Param("issueId") issueId: string,
  ) {
    const activity = await this.activityService.findForIssue(
      workspaceId,
      projectId,
      issueId,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Activity fetched successfully",
      data: activity,
    });
  }
}
