import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { RequirePermission } from "@/common/decorators/require-permission.decorator";
import { WorkspaceId } from "@/common/decorators/workspaceId.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
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
  Query,
  UseGuards,
} from "@nestjs/common";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectService } from "./project.service";

@Controller("projects")
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class ProjectController {
  constructor(private projectService: ProjectService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("project:manage")
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
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Query() query: PaginationQueryDto,
  ) {
    const { data, metaData } = await this.projectService.findAll(
      workspaceId,
      query,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Projects fetched successfully",
      data,
      metaData,
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
  @RequirePermission("project:manage")
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
  @RequirePermission("project:manage")
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
