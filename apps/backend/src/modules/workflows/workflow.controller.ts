import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { RequirePermission } from "@/common/decorators/require-permission.decorator";
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
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ReplaceTransitionsDto } from "./dto/replace-transitions.dto";
import {
  CreateWorkflowStatusDto,
  DeleteWorkflowStatusQueryDto,
  UpdateWorkflowStatusDto,
} from "./dto/workflow-status.dto";
import { WorkflowService } from "./workflow.service";

/**
 * A project's workflow (spec/workflow-spec.md). Any member reads it; edits
 * need `project:manage`, and the service refuses them on Free (402).
 */
@Controller("projects/:projectId/workflow")
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class WorkflowController {
  constructor(private workflowService: WorkflowService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async find(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
  ) {
    const workflow = await this.workflowService.find(workspaceId, projectId);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Workflow fetched successfully",
      data: workflow,
    });
  }

  @Post("statuses")
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("project:manage")
  async createStatus(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Body() dto: CreateWorkflowStatusDto,
  ) {
    const status = await this.workflowService.createStatus(
      workspaceId,
      projectId,
      dto,
    );
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Status created",
      data: status,
    });
  }

  @Patch("statuses/:statusId")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("project:manage")
  async updateStatus(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Param("statusId") statusId: string,
    @Body() dto: UpdateWorkflowStatusDto,
  ) {
    const status = await this.workflowService.updateStatus(
      workspaceId,
      projectId,
      statusId,
      dto,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Status updated",
      data: status,
    });
  }

  @Delete("statuses/:statusId")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("project:manage")
  async deleteStatus(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: JwtPayload,
    @Param("projectId") projectId: string,
    @Param("statusId") statusId: string,
    @Query() query: DeleteWorkflowStatusQueryDto,
  ) {
    const status = await this.workflowService.deleteStatus(
      workspaceId,
      projectId,
      statusId,
      user.sub,
      query.moveTo,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Status deleted",
      data: status,
    });
  }

  @Patch("transitions")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("project:manage")
  async replaceTransitions(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Body() dto: ReplaceTransitionsDto,
  ) {
    const transitions = await this.workflowService.replaceTransitions(
      workspaceId,
      projectId,
      dto,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Transitions updated",
      data: transitions,
    });
  }
}
