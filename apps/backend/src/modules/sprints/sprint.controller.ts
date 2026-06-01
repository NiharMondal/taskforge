import { MembershipRole } from "@/common/decorators/membership-role.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { WorkspaceId } from "@/common/decorators/workspaceId.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
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
import { WorkspaceRole } from "generated/prisma/enums";
import { CreateSprintDto } from "./dto/create-sprint.dto";
import { SprintService } from "./sprint.service";

@Controller("projects/:projectId/sprints")
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class SprintController {
  constructor(private sprintService: SprintService) {}

  @Post()
  async create(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @MembershipRole() membershipRole: WorkspaceRole,
    @Body() dto: CreateSprintDto,
  ) {
    const sprint = await this.sprintService.create(
      workspaceId,
      projectId,
      membershipRole,
      dto,
    );
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

  @Patch(":sprintId/start")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  async start(
    @WorkspaceId() workspaceId: string,
    @Param("sprintId") sprintId: string,
    @MembershipRole() membershipRole: WorkspaceRole,
  ) {
    const sprint = await this.sprintService.startSprint(
      workspaceId,
      sprintId,
      membershipRole,
    );

    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Sprint started successfully",
      data: sprint,
    });
  }

  @Patch(":sprintId/end")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  async end(
    @WorkspaceId() workspaceId: string,
    @Param("sprintId") sprintId: string,
    @MembershipRole() membershipRole: WorkspaceRole,
  ) {
    const sprint = await this.sprintService.endSprint(
      workspaceId,
      sprintId,
      membershipRole,
    );

    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Sprint ended successfully",
      data: sprint,
    });
  }
}
