import { MembershipRole } from "@/common/decorators/membership-role.decorator";
import { WorkspaceId } from "@/common/decorators/workspaceId.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { WorkspaceGuard } from "@/common/guards/workspace.guard";
import {
  Body,
  Controller,
  Get,
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
  create(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @MembershipRole() membershipRole: WorkspaceRole,
    @Body() dto: CreateSprintDto,
  ) {
    return this.sprintService.create(
      workspaceId,
      projectId,
      membershipRole,
      dto,
    );
  }

  @Get()
  findAll(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
  ) {
    return this.sprintService.findAll(workspaceId, projectId);
  }

  @Patch(":sprintId/start")
  start(
    @WorkspaceId() workspaceId: string,
    @Param("sprintId") sprintId: string,
    @MembershipRole() membershipRole: WorkspaceRole,
  ) {
    return this.sprintService.startSprint(
      workspaceId,
      sprintId,
      membershipRole,
    );
  }

  @Patch(":sprintId/end")
  end(
    @WorkspaceId() workspaceId: string,
    @Param("sprintId") sprintId: string,
    @MembershipRole() membershipRole: WorkspaceRole,
  ) {
    return this.sprintService.endSprint(workspaceId, sprintId, membershipRole);
  }
}
