import { Access } from "@/common/decorators/access.decorator";
import { RequirePermission } from "@/common/decorators/require-permission.decorator";
import { WorkspaceId } from "@/common/decorators/workspaceId.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { WorkspaceGuard } from "@/common/guards/workspace.guard";
import type { WorkspaceAccess } from "@/common/permissions/workspace-access";
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
import { CommentService } from "./comment.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";

@Controller("projects/:projectId/issues/:issueId/comments")
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class CommentController {
  constructor(private commentService: CommentService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Param("issueId") issueId: string,
  ) {
    const comments = await this.commentService.findAll(
      workspaceId,
      projectId,
      issueId,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Comments fetched successfully",
      data: comments,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission("comment:create")
  async create(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Param("issueId") issueId: string,
    @Access() access: WorkspaceAccess,
    @Body() dto: CreateCommentDto,
  ) {
    const comment = await this.commentService.create(
      workspaceId,
      projectId,
      issueId,
      access.userId,
      dto,
    );
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Comment added",
      data: comment,
    });
  }

  @Patch(":commentId")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("comment:create")
  async update(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Param("issueId") issueId: string,
    @Param("commentId") commentId: string,
    @Access() access: WorkspaceAccess,
    @Body() dto: UpdateCommentDto,
  ) {
    const comment = await this.commentService.update(
      workspaceId,
      projectId,
      issueId,
      commentId,
      access,
      dto,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Comment updated",
      data: comment,
    });
  }

  @Delete(":commentId")
  @HttpCode(HttpStatus.OK)
  async remove(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Param("issueId") issueId: string,
    @Param("commentId") commentId: string,
    @Access() access: WorkspaceAccess,
  ) {
    const comment = await this.commentService.remove(
      workspaceId,
      projectId,
      issueId,
      commentId,
      access,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Comment deleted",
      data: comment,
    });
  }
}
