import { Roles } from "@/common/decorators/roles.decorator";
import { WorkspaceId } from "@/common/decorators/workspaceId.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { RolesGuard } from "@/common/guards/roles.guard";
import { WorkspaceGuard } from "@/common/guards/workspace.guard";
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
import { WorkspaceRole } from "generated/prisma/enums";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectService } from "./project.service";

@Controller("workspaces/:workspaceId/projects")
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class ProjectController {
  constructor(private projectService: ProjectService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateProjectDto,
  ) {
    const project = await this.projectService.create(workspaceId, dto);
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Project created successfully",
      data: project,
    });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@WorkspaceId() workspaceId: string) {
    const projects = await this.projectService.findAll(workspaceId);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Projects fetched successfully",
      data: projects,
    });
  }

  @Get(":projectId")
  @HttpCode(HttpStatus.OK)
  async findOne(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
  ) {
    const project = await this.projectService.findOne(workspaceId, projectId);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Project fetched successfully",
      data: project,
    });
  }

  @Patch(":projectId")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  async update(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    const project = await this.projectService.update(
      workspaceId,
      projectId,
      dto,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Project updated successfully",
      data: project,
    });
  }

  @Delete(":projectId")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  async delete(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
  ) {
    const project = await this.projectService.delete(workspaceId, projectId);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Project deleted successfully",
      data: project,
    });
  }
}
