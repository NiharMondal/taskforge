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
import { WorkspaceService } from "./workspace.service";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { sendResponse } from "@/common/utils/send-response";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import type { JwtPayload } from "@/modules/auth/strategies/jwt.strategy";

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

  // GET ALL
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
  @Get(":id")
  @HttpCode(HttpStatus.OK)
  async findOne(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    const res = await this.workspaceService.findOne(id, user.sub);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Workspace fetched successfully",
      data: res,
    });
  }

  // UPDATE
  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  async update(
    @CurrentUser() user: JwtPayload,
    @Param("id") id: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    const res = await this.workspaceService.update(id, user.sub, dto);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Workspace updated successfully",
      data: res,
    });
  }

  // DELETE
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async delete(@CurrentUser() user: JwtPayload, @Param("id") id: string) {
    const res = await this.workspaceService.delete(id, user.sub);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Workspace deleted successfully",
      data: res,
    });
  }
}
