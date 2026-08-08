import PrismaQueryBuilder from "@/lib/PrismQueryBuilder";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { generateKeyBetween } from "fractional-indexing";
import { IssueStatus, WorkspaceRole } from "generated/prisma/enums";
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
    await this.validateAssignee(workspaceId, dto.assigneeId);
    await this.validateSprint(workspaceId, projectId, dto.sprintId);

    // Mirror the schema default explicitly: the lane a new card lands in decides
    // which ranks it has to sort after.
    const status = dto.status ?? IssueStatus.BACKLOG;

    return this.prisma.issue.create({
      data: {
        title: dto.title,
        description: dto.description,
        status,
        priority: dto.priority,
        sprintId: dto.sprintId,
        assigneeId: dto.assigneeId,
        rank: await this.appendRank(workspaceId, projectId, status),
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
      allowedFields: ["createdAt", "priority", "status", "rank"],
    })
      .withDefaultFilter({ workspaceId, projectId })
      .filter()
      .search(["title", "description"])
      .paginate()
      .sort()
      .include({
        assignee: { select: { id: true, name: true, email: true } },
        reporter: {
          select: { id: true, name: true, avatarUrl: true },
        },
        sprint: { select: { id: true, name: true } },
      });

    const { data, metaData } = await qb.execute(this.prisma.issue);

    return { issues: data, metaData };
  }

  async findOne(workspaceId: string, projectId: string, issueId: string) {
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, workspaceId, projectId },
      include: {
        reporter: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
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
    membershipRole: WorkspaceRole,
    dto: UpdateIssueDto,
  ) {
    if (membershipRole === WorkspaceRole.MEMBER) {
      // `rank` is deliberately absent: moving a card on the board is a status
      // change plus a position, so members who may re-status an issue may also
      // reorder it.
      const restrictedFields = [
        "title",
        "priority",
        "sprintId",
        "assigneeId",
      ] as const;
      const hasRestrictedField = restrictedFields.some(
        (f) => dto[f] !== undefined,
      );
      if (hasRestrictedField) {
        throw new ForbiddenException(
          "Members can only update the issue status",
        );
      }
      if (dto.status === IssueStatus.DONE) {
        throw new ForbiddenException("Members cannot mark an issue as DONE");
      }
    }

    const issue = await this.findOne(workspaceId, projectId, issueId);
    await this.validateAssignee(workspaceId, dto.assigneeId);
    await this.validateSprint(workspaceId, projectId, dto.sprintId);
    return this.prisma.issue.update({
      where: { id: issueId },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        sprintId: dto.sprintId,
        assigneeId: dto.assigneeId,
        rank: await this.resolveUpdateRank(
          workspaceId,
          projectId,
          issue.status,
          dto,
        ),
      },
    });
  }

  async remove(workspaceId: string, projectId: string, issueId: string) {
    await this.findOne(workspaceId, projectId, issueId);

    return this.prisma.issue.delete({
      where: { id: issueId },
    });
  }

  /**
   * The rank to persist for an update, or `undefined` to leave the stored one
   * alone (Prisma ignores undefined fields).
   *
   * The board computes the fractional key client-side on drop and sends it with
   * the new status — that key is authoritative, it is what the user just saw.
   * When a status change arrives *without* a rank (the frontend falls back to a
   * status-only PATCH when it cannot compute a key) the card would otherwise
   * keep the rank it held in the lane it left and sort arbitrarily in its new
   * one, so append it to the end of the target lane instead.
   */
  private async resolveUpdateRank(
    workspaceId: string,
    projectId: string,
    currentStatus: IssueStatus,
    dto: UpdateIssueDto,
  ) {
    if (dto.rank !== undefined) {
      this.validateRank(dto.rank);
      return dto.rank;
    }

    if (!dto.status || dto.status === currentStatus) return undefined;

    return this.appendRank(workspaceId, projectId, dto.status);
  }

  /**
   * A fractional index that sorts after every ranked issue in a
   * `(project, status)` lane — i.e. appends to the end of the lane.
   *
   * Un-ranked rows are filtered out: Postgres sorts NULLs first on `DESC`, so
   * a single un-backfilled row would otherwise shadow the real maximum.
   */
  private async appendRank(
    workspaceId: string,
    projectId: string,
    status: IssueStatus,
  ) {
    const last = await this.prisma.issue.findFirst({
      where: { workspaceId, projectId, status, rank: { not: null } },
      orderBy: { rank: "desc" },
      select: { rank: true },
    });

    try {
      return generateKeyBetween(last?.rank ?? null, null);
    } catch {
      // A stored key that isn't a valid fractional index (hand-edited row, or a
      // botched backfill) would otherwise 500 every create in that lane. Start a
      // fresh sequence instead — the card may land mid-lane, but the write lands.
      return generateKeyBetween(null, null);
    }
  }

  /** Reject a client-supplied rank the fractional-index library can't build on. */
  private validateRank(rank: string) {
    try {
      generateKeyBetween(rank, null);
    } catch {
      throw new BadRequestException("Invalid issue rank");
    }
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

  private async validateAssignee(workspaceId: string, assigneeId?: string) {
    if (!assigneeId) return;

    const member = await this.prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: assigneeId,
          workspaceId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException("Assignee must belong to workspace");
    }
  }

  private async validateSprint(
    workspaceId: string,
    projectId: string,
    sprintId?: string,
  ) {
    if (!sprintId) return;

    const sprint = await this.prisma.sprint.findFirst({
      where: {
        id: sprintId,
        workspaceId,
        projectId,
      },
    });

    if (!sprint) {
      throw new ForbiddenException("Invalid sprint assignment");
    }
  }
}
