import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { WorkspaceId } from "@/common/decorators/workspaceId.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { WorkspaceGuard } from "@/common/guards/workspace.guard";
import type { JwtPayload } from "@/common/strategies/jwt.strategy";
import { sendResponse } from "@/common/utils/send-response";
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from "@nestjs/common";
import { IssueService } from "./issue.service";

/**
 * The one workspace-wide issue read: the caller's own open issues across the
 * workspace's projects, for the dashboard. Every other issue route is
 * project-scoped (`IssueController`). The assignee is always the caller — the
 * route takes no user id, so it can't be used to list someone else's work.
 */
@Controller("issues")
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class AssignedIssuesController {
  constructor(private issueService: IssueService) {}

  @Get("assigned")
  @HttpCode(HttpStatus.OK)
  async findAssigned(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationQueryDto,
  ) {
    const { issues, metaData } = await this.issueService.findAssigned(
      workspaceId,
      user.sub,
      query,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Assigned issues fetched successfully",
      data: issues,
      metaData,
    });
  }
}
