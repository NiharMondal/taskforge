import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { MembershipRole } from "@/common/decorators/membership-role.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { WorkspaceId } from "@/common/decorators/workspaceId.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
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
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { WorkspaceRole } from "generated/prisma/enums";
import { CreateIssueDto } from "./dto/create-issue.dto";
import { QueryIssuesDto } from "./dto/query-issues.dto";
import { UpdateIssueDto } from "./dto/update-issue.dto";
import { IssueService } from "./issue.service";

@Controller("projects/:projectId/issues")
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class IssueController {
  constructor(private issueService: IssueService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  async create(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateIssueDto,
  ) {
    const issue = await this.issueService.create(
      workspaceId,
      projectId,
      user.sub,
      dto,
    );
    return sendResponse({
      statusCode: HttpStatus.CREATED,
      message: "Issue created successfully",
      data: issue,
    });
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Query() query: QueryIssuesDto,
  ) {
    const { issues, metaData } = await this.issueService.findAll(
      workspaceId,
      projectId,
      query,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Issues fetched successfully",
      data: issues,
      metaData,
    });
  }

  @Get(":issueId")
  @HttpCode(HttpStatus.OK)
  async findOne(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Param("issueId") issueId: string,
  ) {
    const issue = await this.issueService.findOne(
      workspaceId,
      projectId,
      issueId,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Issue fetched successfully",
      data: issue,
    });
  }

  @Patch(":issueId")
  @HttpCode(HttpStatus.OK)
  async update(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Param("issueId") issueId: string,
    @MembershipRole() membershipRole: WorkspaceRole,
    @Body() dto: UpdateIssueDto,
  ) {
    const issue = await this.issueService.update(
      workspaceId,
      projectId,
      issueId,
      membershipRole,
      dto,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Issue updated successfully",
      data: issue,
    });
  }

  @Delete(":issueId")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  async remove(
    @WorkspaceId() workspaceId: string,
    @Param("projectId") projectId: string,
    @Param("issueId") issueId: string,
  ) {
    const issue = await this.issueService.remove(
      workspaceId,
      projectId,
      issueId,
    );
    return sendResponse({
      statusCode: HttpStatus.OK,
      message: "Issue deleted successfully",
      data: issue,
    });
  }
}
