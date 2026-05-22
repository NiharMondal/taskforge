import { PrismaService } from "@/prisma/prisma.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { CreateIssueDto } from "./dto/create-issue.dto";
import { QueryIssuesDto } from "./dto/query-issues.dto";
import { UpdateIssueDto } from "./dto/update-issue.dto";

@Injectable()
export class IssueService {
  constructor(private prisma: PrismaService) {}

  async create(
    workspaceId: string,
    projectId: string,
    reporterId: string,
    dto: CreateIssueDto,
  ) {
    await this.validateProject(workspaceId, projectId);

    return this.prisma.issue.create({
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        sprintId: dto.sprintId,
        assigneeId: dto.assigneeId,
        workspaceId,
        projectId,
        reporterId,
      },
    });
  }

  async findAll(workspaceId: string, projectId: string, query: QueryIssuesDto) {
    await this.validateProject(workspaceId, projectId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      workspaceId,
      projectId,
      ...(query.status && { status: query.status }),
      ...(query.priority && { priority: query.priority }),
      ...(query.assigneeId && { assigneeId: query.assigneeId }),
      ...(query.sprintId && { sprintId: query.sprintId }),
    };

    const [issues, total] = await this.prisma.$transaction([
      this.prisma.issue.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.issue.count({ where }),
    ]);

    return {
      issues,
      metaData: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(workspaceId: string, projectId: string, issueId: string) {
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, workspaceId, projectId },
    });

    if (!issue) {
      throw new NotFoundException("Issue not found");
    }

    return issue;
  }

  async update(
    workspaceId: string,
    projectId: string,
    issueId: string,
    dto: UpdateIssueDto,
  ) {
    await this.findOne(workspaceId, projectId, issueId);

    return this.prisma.issue.update({
      where: { id: issueId },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        sprintId: dto.sprintId,
        assigneeId: dto.assigneeId,
      },
    });
  }

  async remove(workspaceId: string, projectId: string, issueId: string) {
    await this.findOne(workspaceId, projectId, issueId);

    return this.prisma.issue.delete({
      where: { id: issueId },
    });
  }

  private async validateProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    return project;
  }
}
