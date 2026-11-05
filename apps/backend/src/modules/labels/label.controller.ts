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
  UseGuards,
} from "@nestjs/common";
import { CreateLabelDto } from "./dto/create-label.dto";
import { UpdateLabelDto } from "./dto/update-label.dto";
import { LabelService } from "./label.service";

@Controller("labels")
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class LabelController {
  constructor(private labelService: LabelService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@WorkspaceId() workspaceId: string) {
    const labels = await this.labelService.findAll(workspaceId);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Labels fetched successfully",
      data: labels,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("label:manage")
  async create(
    @WorkspaceId() workspaceId: string,
    @Body() dto: CreateLabelDto,
  ) {
    const label = await this.labelService.create(workspaceId, dto);
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Label created",
      data: label,
    });
  }

  @Patch(":labelId")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("label:manage")
  async update(
    @WorkspaceId() workspaceId: string,
    @Param("labelId") labelId: string,
    @Body() dto: UpdateLabelDto,
  ) {
    const label = await this.labelService.update(workspaceId, labelId, dto);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Label updated",
      data: label,
    });
  }

  @Delete(":labelId")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("label:manage")
  async remove(
    @WorkspaceId() workspaceId: string,
    @Param("labelId") labelId: string,
  ) {
    const label = await this.labelService.remove(workspaceId, labelId);
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Label deleted",
      data: label,
    });
  }
}
