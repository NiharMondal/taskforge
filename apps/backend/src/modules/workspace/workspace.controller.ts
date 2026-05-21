import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { WorkspaceId } from "@/common/decorators/workspaceId.decorator";
import { RolesGuard } from "@/common/guards/roles.guard";
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
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { WorkspaceRole } from "generated/prisma/enums";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";
import { WorkspaceService } from "./workspace.service";

@Controller("workspaces")
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private workspaceService: WorkspaceService) {}

  // CREATE
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateWorkspaceDto,
  ) {
    const res = await this.workspaceService.create(user.sub, dto.name);
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Workspace created successfully",
      data: res.workspace,
    });
  }

  // GET ALL workspaces of user
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@CurrentUser() user: JwtPayload) {
    const res = await this.workspaceService.getUserWorkspaces(user.sub);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Workspaces fetched successfully",
      data: res,
    });
  }

  // GET ONE
  @Get(":workspaceId")
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  async findOne(@CurrentUser() user: JwtPayload, @WorkspaceId() id: string) {
    const res = await this.workspaceService.findOne(id, user.sub);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Workspace fetched successfully",
      data: res,
    });
  }

  // UPDATE
  @Patch(":workspaceId")
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  async update(
    @WorkspaceId() workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    const res = await this.workspaceService.update(workspaceId, dto);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Workspace updated successfully",
      data: res,
    });
  }

  // DELETE
  @Delete(":workspaceId")
  @HttpCode(HttpStatus.OK)
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER)
  async delete(@WorkspaceId() workspaceId: string) {
    const res = await this.workspaceService.delete(workspaceId);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Workspace deleted successfully",
      data: res,
    });
  }
}
