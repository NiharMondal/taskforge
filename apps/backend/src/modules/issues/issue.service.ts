import {
  assertCanSetStatus,
  assertCanUpdateIssue,
  assertCanUpdateSomeIssue,
} from "@/common/permissions/issue-access";
import type { WorkspaceAccess } from "@/common/permissions/workspace-access";
import PrismaQueryBuilder from "@/lib/PrismQueryBuilder";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { generateKeyBetween } from "fractional-indexing";
import type { Prisma } from "generated/prisma/client";
import { IssueStatus } from "generated/prisma/enums";
import { CreateIssueDto } from "./dto/create-issue.dto";
import { QueryIssuesDto } from "./dto/query-issues.dto";
import { UpdateIssueDto } from "./dto/update-issue.dto";
import { isAllowedTransition } from "./status-transitions";

/** The Prisma client, or a transaction client from `$transaction`. */
type Db = Pick<Prisma.TransactionClient, "issue">;

/** True when the fractional-indexing library can build a key after `rank`. */
function isValidRank(rank: string): boolean {
  try {
    generateKeyBetween(rank, null);
    return true;
  } catch {
    return false;
  }
}

@Injectable()
export class IssueService {
  constructor(private prisma: PrismaService) {}

  async create(
    workspaceId: string,
    projectId: string,
    reporterId: string,
    access: WorkspaceAccess,
    dto: CreateIssueDto,
  ) {
    // `issue:create` itself is checked on the route.
    assertCanSetStatus(access, dto.status);
    await this.validateProject(workspaceId, projectId);
    await this.validateAssignee(workspaceId, dto.assigneeId);
    await this.validateSprint(workspaceId, projectId, dto.sprintId);

    // Mirror the schema default explicitly: the lane a new card lands in decides
    // which ranks it has to sort after.
    const status = dto.status ?? IssueStatus.BACKLOG;

    return this.inLockedLane(projectId, status, async (tx) =>
      tx.issue.create({
        data: {
          title: dto.title,
          description: dto.description,
          status,
          priority: dto.priority,
          sprintId: dto.sprintId,
          assigneeId: dto.assigneeId,
          rank: await this.appendRank(tx, workspaceId, projectId, status),
          workspaceId,
          projectId,
          reporterId,
        },
      }),
    );
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
        // `email` lives on `Auth`, not `User` — selecting it here makes Prisma
        // reject the whole query. Mirrors `findOne`.
        assignee: { select: { id: true, name: true, avatarUrl: true } },
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
    access: WorkspaceAccess,
    dto: UpdateIssueDto,
  ) {
    assertCanUpdateSomeIssue(access);

    const issue = await this.findOne(workspaceId, projectId, issueId);
    assertCanUpdateIssue(access, issue, dto);

    if (dto.status && !isAllowedTransition(issue.status, dto.status)) {
      throw new BadRequestException(
        `An issue can't move from ${issue.status} to ${dto.status}`,
      );
    }

    await this.validateAssignee(workspaceId, dto.assigneeId);
    await this.validateSprint(workspaceId, projectId, dto.sprintId);

    const write = (db: Db, rank: string | undefined) =>
      db.issue.update({
        where: { id: issueId },
        data: {
          title: dto.title,
          description: dto.description,
          status: dto.status,
          priority: dto.priority,
          sprintId: dto.sprintId,
          assigneeId: dto.assigneeId,
          rank,
        },
      });

    if (dto.rank !== undefined) {
      // The board computed the key on drop from what the user saw; store it
      // verbatim.
      this.validateRank(dto.rank);
      return write(this.prisma, dto.rank);
    }

    // A status change without a rank (the board falls back to a status-only
    // PATCH when it can't compute a key) would keep the rank the card had in
    // the lane it left and sort arbitrarily in the new one, so append it to the
    // end of the target lane — the same way a create does.
    const targetLane = dto.status;
    if (targetLane && targetLane !== issue.status) {
      return this.inLockedLane(projectId, targetLane, async (tx) =>
        write(
          tx,
          await this.appendRank(tx, workspaceId, projectId, targetLane),
        ),
      );
    }

    return write(this.prisma, undefined);
  }

  async remove(workspaceId: string, projectId: string, issueId: string) {
    await this.findOne(workspaceId, projectId, issueId);

    return this.prisma.issue.delete({
      where: { id: issueId },
    });
  }

  /**
   * Run `write` in a transaction holding a lock on one `(project, status)`
   * lane. Appending reads the lane's last rank and writes the next one; without
   * the lock, two appends at the same moment read the same last rank and give
   * both cards the same key, which the board can't place anything between.
   * The advisory lock is released when the transaction ends.
   */
  private inLockedLane<T>(
    projectId: string,
    status: IssueStatus,
    write: (tx: Db) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const lane = `issue-lane:${projectId}:${status}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lane}::text, 0))`;
      return write(tx);
    });
  }

  /**
   * A fractional index that sorts after every ranked issue in a
   * `(project, status)` lane — i.e. appends to the end of the lane. Call it
   * inside `inLockedLane` for that lane.
   *
   * Un-ranked rows are filtered out: Postgres sorts NULLs first on `DESC`, so
   * a single un-backfilled row would otherwise shadow the real maximum. The
   * column sorts in byte order (COLLATE "C"), matching the keys.
   */
  private async appendRank(
    db: Db,
    workspaceId: string,
    projectId: string,
    status: IssueStatus,
  ) {
    const where = { workspaceId, projectId, status, rank: { not: null } };
    const last = await db.issue.findFirst({
      where,
      orderBy: { rank: "desc" },
      select: { rank: true },
    });

    try {
      return generateKeyBetween(last?.rank ?? null, null);
    } catch {
      // The highest stored key isn't a valid fractional index (hand-edited
      // row, botched backfill). Append after the highest key that *is* valid
      // rather than restarting at "a0", which would likely collide.
      const ranks = await db.issue.findMany({ where, select: { rank: true } });
      const highestValid = ranks
        .map((r) => r.rank as string)
        .filter(isValidRank)
        .reduce<string | null>(
          (max, r) => (max === null || r > max ? r : max),
          null,
        );
      return generateKeyBetween(highestValid, null);
    }
  }

  /** Reject a client-supplied rank the fractional-index library can't build on. */
  private validateRank(rank: string) {
    if (!isValidRank(rank)) {
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
