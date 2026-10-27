import { RequirePermission } from "@/common/decorators/require-permission.decorator";
import { WorkspaceId } from "@/common/decorators/workspaceId.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { WorkspaceGuard } from "@/common/guards/workspace.guard";
import { sendResponse } from "@/common/utils/send-response";
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CreateSprintDto } from "./dto/create-sprint.dto";
import { UpdateSprintDto } from "./dto/update-sprint.dto";
import { SprintService } from "./sprint.service";

@Controller("projects/:projectId/sprints")
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class SprintController {
  constructor(private sprintService: SprintService) {}

  @Post()
  @RequirePermission("sprint:manage")
  async create(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Body() dto: CreateSprintDto,
  ) {
    const sprint = await this.sprintService.create(workspaceId, projectId, dto);
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Sprint created successfully",
      data: sprint,
    });
  }

  @Get()
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
  ) {
    const sprints = await this.sprintService.findAll(workspaceId, projectId);

    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Sprints fetched successfully",
      data: sprints,
    });
  }

  @Patch(":sprintId")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("sprint:manage")
  async updateSprint(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Param("sprintId") sprintId: string,
    @Body() dto: UpdateSprintDto,
  ) {
    const sprint = await this.sprintService.updateSprint(
      workspaceId,
      projectId,
      sprintId,
      dto,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Sprint updated successfully",
      data: sprint,
    });
  }
  @Patch(":sprintId/start")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("sprint:manage")
  async start(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Param("sprintId") sprintId: string,
  ) {
    const sprint = await this.sprintService.startSprint(
      workspaceId,
      projectId,
      sprintId,
    );

    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Sprint started successfully",
      data: sprint,
    });
  }

  @Patch(":sprintId/end")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("sprint:manage")
  async end(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Param("sprintId") sprintId: string,
  ) {
    const sprint = await this.sprintService.endSprint(
      workspaceId,
      projectId,
      sprintId,
    );

    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Sprint ended successfully",
      data: sprint,
    });
  }
}
