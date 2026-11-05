import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { RequirePermission } from "@/common/decorators/require-permission.decorator";
import { WorkspaceId } from "@/common/decorators/workspaceId.decorator";
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
  Query,
  UseGuards,
} from "@nestjs/common";
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
    const res = await this.workspaceService.create(user.sub, dto);
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Workspace created successfully",
      data: res.workspace,
    });
  }

  // GET ALL workspaces of user
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: PaginationQueryDto,
  ) {
    const { data, metaData } = await this.workspaceService.getUserWorkspaces(
      user.sub,
      query,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Workspaces fetched successfully",
      data,
      metaData,
    });
  }

  // GET ONE
  @Get(":workspaceId")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("workspace:manage")
  @UseGuards(WorkspaceGuard)
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
  @RequirePermission("workspace:manage")
  @UseGuards(WorkspaceGuard)
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
  @RequirePermission("workspace:delete")
  @UseGuards(WorkspaceGuard)
  async delete(@WorkspaceId() workspaceId: string) {
    const res = await this.workspaceService.delete(workspaceId);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Workspace deleted successfully",
      data: res,
    });
  }
}
