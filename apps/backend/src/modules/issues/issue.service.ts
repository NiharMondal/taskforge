import PrismaQueryBuilder from "@/lib/PrismQueryBuilder";
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

    const qb = new PrismaQueryBuilder(query, {
      defaultField: "createdAt",
      defaultOrder: "desc",
      allowedFields: ["createdAt", "priority", "status"],
    })
      // always applied filters
      .withDefaultFilter({
        workspaceId,
        projectId,
      })

      // dynamic filters from query (?status=OPEN&priority=HIGH)
      .filter()

      // search (optional)
      .search(["title", "description"])

      // pagination (?page=1&limit=10)
      .paginate()

      // sorting (?sort=priority:asc)
      .sort()

      // optional relations
      .include({
        assignee: true,
        sprint: true,
      });

    const { data, metaData } = await qb.execute(this.prisma.issue);

    return {
      issues: data,
      metaData,
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
