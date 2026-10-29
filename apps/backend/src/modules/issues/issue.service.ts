import {
  assertCanSetStatus,
  assertCanUpdateIssue,
  assertCanUpdateSomeIssue,
} from "@/common/permissions/issue-access";
import type { WorkspaceAccess } from "@/common/permissions/workspace-access";
import PrismaQueryBuilder from "@/lib/PrismQueryBuilder";
import {
  IssueActivity,
  issueChanges,
  type IssueSnapshot,
  type LabelRef,
  recordIssueActivity,
  type Ref,
} from "@/modules/activity/issue-activity";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "generated/prisma/client";
import { IssueType, StatusCategory } from "generated/prisma/enums";
import { CreateIssueDto } from "./dto/create-issue.dto";
import { QueryIssuesDto } from "./dto/query-issues.dto";
import { UpdateIssueDto } from "./dto/update-issue.dto";
import { isValidRank, rankBetween } from "@taskforge/shared";
import { type IssueLane, lastRankInLane, lockIssueLane } from "./issue-lane";

/** The Prisma client, or a transaction client from `$transaction`. */
type Db = Pick<Prisma.TransactionClient, "issue" | "project" | "auditLog">;

/**
 * Every issue read embeds its workflow status. The project names its
 * statuses, so rules read `category`, never `name`.
 */
const STATUS_SELECT = {
  select: { id: true, name: true, color: true, category: true },
} as const;

type StatusRef = Prisma.WorkflowStatusGetPayload<typeof STATUS_SELECT>;

/** Every issue read embeds its labels, alphabetically. */
const LABELS_INCLUDE = {
  labels: {
    orderBy: { label: { name: "asc" } },
    select: { label: { select: { id: true, name: true, color: true } } },
  },
} as const;

/** The join rows (`labels: [{ label }]`) as the labels themselves. */
function flattenLabels<T extends { labels: { label: unknown }[] }>({
  labels,
  ...issue
}: T) {
  return { ...issue, labels: labels.map((l) => l.label) };
}

/** The stored issue in the shape `issueChanges` compares. */
function snapshotOf(issue: {
  title: string;
  description: string | null;
  status: StatusRef;
  priority: string;
  type: string;
  timeEstimate: number | null;
  assignee: Ref | null;
  sprint: Ref | null;
  labels: { label: LabelRef }[];
}): IssueSnapshot {
  return {
    title: issue.title,
    description: issue.description,
    // By name, copied into the history row like assignee and sprint names, so
    // history survives renames and deletes.
    status: issue.status.name,
    priority: issue.priority,
    type: issue.type,
    timeEstimate: issue.timeEstimate,
    assignee: issue.assignee && {
      id: issue.assignee.id,
      name: issue.assignee.name,
    },
    sprint: issue.sprint,
    labels: issue.labels.map((l) => l.label),
  };
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
    await this.validateProject(workspaceId, projectId);
    await this.validateAssignee(workspaceId, dto.assigneeId);
    await this.validateSprint(workspaceId, projectId, dto.sprintId);
    await this.validateLabels(workspaceId, dto.labelIds);
    const parent = await this.validateParent(
      workspaceId,
      projectId,
      dto.parentIssueId,
    );
    if (parent && dto.type) {
      throw new BadRequestException("A sub-issue's type is always SUBTASK");
    }

    // A sub-issue is part of its parent's work, so it starts in the parent's
    // sprint unless one was chosen.
    const sprintId = dto.sprintId ?? parent?.sprintId;
    // Without a status, the project's default; the lane a new card lands in
    // decides which ranks it has to sort after. Work planned into a sprint
    // starts unstarted (see `committedStatus`).
    const status = await this.committedStatus(
      workspaceId,
      projectId,
      dto.statusId
        ? await this.validateStatus(workspaceId, projectId, dto.statusId)
        : await this.defaultStatus(workspaceId, projectId),
      sprintId,
    );
    assertCanSetStatus(access, status.category);
    const lane = { workspaceId, projectId, statusId: status.id };

    return this.inLockedLane(lane, async (tx) => {
      const issue = await tx.issue.create({
        data: {
          title: dto.title,
          description: dto.description,
          statusId: status.id,
          priority: dto.priority,
          timeEstimate: dto.timeEstimate,
          sprintId,
          assigneeId: dto.assigneeId,
          ...(dto.type && { type: dto.type }),
          ...(dto.labelIds?.length && {
            labels: {
              create: dto.labelIds.map((labelId) => ({ labelId })),
            },
          }),
          ...(parent && {
            parentIssueId: parent.id,
            type: IssueType.SUBTASK,
          }),
          number: await this.nextIssueNumber(tx, projectId),
          rank: await this.appendRank(tx, lane),
          workspaceId,
          projectId,
          reporterId,
        },
        include: { status: STATUS_SELECT },
      });
      await recordIssueActivity(tx, {
        workspaceId,
        issueId: issue.id,
        userId: reporterId,
        action: IssueActivity.created,
      });
      return issue;
    });
  }

  async findAll(workspaceId: string, projectId: string, query: QueryIssuesDto) {
    await this.validateProject(workspaceId, projectId);

    const qb = new PrismaQueryBuilder(query, {
      defaultField: "createdAt",
      defaultOrder: "desc",
      allowedFields: ["createdAt", "priority", "rank"],
    })
      .withDefaultFilter({ workspaceId, projectId })
      .filter()
      .search(["title", "description"])
      .paginate()
      .sort()
      .include({
        status: STATUS_SELECT,
        // `email` lives on `Auth`, not `User` — selecting it here makes Prisma
        // reject the whole query. Mirrors `findOne`.
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        reporter: {
          select: { id: true, name: true, avatarUrl: true },
        },
        sprint: { select: { id: true, name: true } },
        // For the "↳ WA-3" tag on sub-issue rows and cards.
        parentIssue: { select: { id: true, number: true, title: true } },
        // The comment count on board cards; the thread itself is its own route.
        _count: { select: { comments: true } },
        ...LABELS_INCLUDE,
      });

    const { data, metaData } = await qb.execute(this.prisma.issue);

    return { issues: data.map(flattenLabels), metaData };
  }

  /**
   * The issue page's read: `findOne` plus its parent and sub-issues. Kept
   * separate so the writes that start with `findOne` don't load them.
   */
  async findDetail(workspaceId: string, projectId: string, issueId: string) {
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, workspaceId, projectId },
      include: {
        status: STATUS_SELECT,
        reporter: { select: { id: true, name: true, avatarUrl: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        parentIssue: { select: { id: true, number: true, title: true } },
        ...LABELS_INCLUDE,
        subIssues: {
          orderBy: { number: "asc" },
          select: {
            id: true,
            number: true,
            title: true,
            statusId: true,
            status: STATUS_SELECT,
            priority: true,
            assigneeId: true,
            assignee: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException("Issue not found");
    }

    return flattenLabels(issue);
  }

  /**
   * The stored issue, as writes start from it: with its status, sprint and
   * labels, which `update` compares against for the history.
   */
  async findOne(workspaceId: string, projectId: string, issueId: string) {
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, workspaceId, projectId },
      include: {
        status: STATUS_SELECT,
        sprint: { select: { id: true, name: true } },
        ...LABELS_INCLUDE,
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

    // Moving a backlog issue into a sprint commits it to the first unstarted
    // status, appended to that lane below like any rank-less status change.
    // The caller needs the permissions it would take to send that status, but
    // not a transition for it: it's the sprint that moves the issue, and a
    // workflow without that move shouldn't stop sprint planning.
    let status: StatusRef | undefined;
    let committed = false;
    if (dto.statusId !== undefined) {
      status = await this.validateStatus(workspaceId, projectId, dto.statusId);
    } else if (dto.sprintId) {
      const next = await this.committedStatus(
        workspaceId,
        projectId,
        issue.status,
        dto.sprintId,
      );
      if (next.id !== issue.statusId) {
        status = next;
        committed = true;
      }
    }
    assertCanUpdateIssue(access, issue, { ...dto, statusId: status?.id });
    assertCanSetStatus(access, status?.category);

    if (
      status &&
      !committed &&
      !(await this.canMove(issue.statusId, status.id))
    ) {
      throw new BadRequestException(
        `An issue can't move from ${issue.status.name} to ${status.name}`,
      );
    }

    // SUBTASK isn't a type anyone can pick (the DTO refuses it), so any type
    // sent for a sub-issue would turn it into a top-level type while it keeps
    // its parent.
    if (dto.type && issue.type === IssueType.SUBTASK) {
      throw new BadRequestException("A sub-issue's type can't be changed");
    }

    const assignee = await this.validateAssignee(workspaceId, dto.assigneeId);
    const sprint = await this.validateSprint(
      workspaceId,
      projectId,
      dto.sprintId,
    );
    const labels = await this.validateLabels(workspaceId, dto.labelIds);

    const changes = issueChanges(snapshotOf(issue), {
      title: dto.title,
      description: dto.description,
      status: status?.name,
      priority: dto.priority,
      type: dto.type,
      timeEstimate: dto.timeEstimate,
      assignee,
      sprint,
      labels,
    });

    const write = (db: Db, rank: string | undefined) =>
      db.issue.update({
        where: { id: issueId },
        data: {
          title: dto.title,
          description: dto.description,
          statusId: status?.id,
          priority: dto.priority,
          type: dto.type,
          timeEstimate: dto.timeEstimate,
          sprintId: dto.sprintId,
          assigneeId: dto.assigneeId,
          // The sent list replaces the issue's labels.
          labels: dto.labelIds && {
            deleteMany: {},
            create: dto.labelIds.map((labelId) => ({ labelId })),
          },
          rank,
        },
        include: { status: STATUS_SELECT },
      });

    // The update and its history row commit together. A save that changes
    // nothing history tracks (e.g. a reorder within a lane) writes no row.
    const save = async (db: Db, rank: string | undefined) => {
      const updated = await write(db, rank);
      if (changes.length > 0) {
        await recordIssueActivity(db, {
          workspaceId,
          issueId,
          userId: access.userId,
          action: IssueActivity.updated,
          metadata: { changes },
        });
      }
      return updated;
    };

    if (dto.rank !== undefined) {
      // The board computed the key on drop from what the user saw. Store it
      // as sent unless another card in the lane already holds it (two people
      // dropping into the same gap) — then just after that card.
      const rank = dto.rank;
      this.validateRank(rank);
      const lane = {
        workspaceId,
        projectId,
        statusId: status?.id ?? issue.statusId,
      };
      return this.inLockedLane(lane, async (tx) =>
        save(tx, await this.freeRank(tx, lane, issueId, rank)),
      );
    }

    // A status change without a rank (the board falls back to a status-only
    // PATCH when it can't compute a key) would keep the rank the card had in
    // the lane it left and sort arbitrarily in the new one, so append it to the
    // end of the target lane — the same way a create does.
    if (status && status.id !== issue.statusId) {
      const lane = { workspaceId, projectId, statusId: status.id };
      return this.inLockedLane(lane, async (tx) =>
        save(tx, await this.appendRank(tx, lane)),
      );
    }

    return this.prisma.$transaction((tx) => save(tx, undefined));
  }

  async remove(workspaceId: string, projectId: string, issueId: string) {
    await this.findOne(workspaceId, projectId, issueId);

    return this.prisma.issue.delete({
      where: { id: issueId },
    });
  }

  /**
   * Run `write` in a transaction holding the lane's lock (`lockIssueLane`),
   * which every rank write takes. The lock is released when the transaction
   * ends.
   */
  private inLockedLane<T>(
    lane: IssueLane,
    write: (tx: Db) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await lockIssueLane(tx, lane.projectId, lane.statusId);
      return write(tx);
    });
  }

  /**
   * A fractional index that sorts after every ranked issue in the lane — i.e.
   * appends to the end of it. Call it inside `inLockedLane` for that lane.
   */
  private async appendRank(db: Db, lane: IssueLane) {
    // A valid key or none at all, so this always builds.
    return rankBetween(await lastRankInLane(db, lane), null)!;
  }

  /**
   * `rank`, or — when another issue in the lane already holds it — a key
   * between that issue and the next one, so the two cards stay orderable.
   * Call it inside `inLockedLane` for that lane: every rank write takes the
   * lock, so a clash committed by a concurrent drop is visible here.
   */
  private async freeRank(
    db: Db,
    lane: IssueLane,
    issueId: string,
    rank: string,
  ) {
    const others = { ...lane, id: { not: issueId } };
    const taken = await db.issue.findFirst({
      where: { ...others, rank },
      select: { id: true },
    });
    if (!taken) return rank;

    const next = await db.issue.findFirst({
      where: { ...others, rank: { gt: rank } },
      orderBy: { rank: "asc" },
      select: { rank: true },
    });
    // An invalid next key can't be built on: append instead.
    return rankBetween(rank, next?.rank) ?? this.appendRank(db, lane);
  }

  /**
   * The project's next issue number (shown as `<key>-<number>`). The increment
   * is a single UPDATE, so its row lock serializes concurrent creates in the
   * project until their transactions end — no two issues get the same number.
   * The project was already checked to be in-tenant by `validateProject`.
   */
  private async nextIssueNumber(db: Db, projectId: string) {
    const { issueCounter } = await db.project.update({
      where: { id: projectId },
      data: { issueCounter: { increment: 1 } },
      select: { issueCounter: true },
    });
    return issueCounter;
  }

  /** Reject a client-supplied rank the fractional-index library can't build on. */
  private validateRank(rank: string) {
    if (!isValidRank(rank)) {
      throw new BadRequestException("Invalid issue rank");
    }
  }

  /** A status of this project's workflow; one from anywhere else is a 400. */
  private async validateStatus(
    workspaceId: string,
    projectId: string,
    statusId: string,
  ): Promise<StatusRef> {
    const status = await this.prisma.workflowStatus.findFirst({
      where: { id: statusId, workspaceId, projectId },
      ...STATUS_SELECT,
    });
    if (!status) {
      throw new BadRequestException("Invalid status for this project");
    }
    return status;
  }

  /**
   * Where an issue created without a status lands. A project always has a
   * default (`WorkflowService` keeps one); the first column covers a project
   * that somehow lost it.
   */
  private async defaultStatus(
    workspaceId: string,
    projectId: string,
  ): Promise<StatusRef> {
    const status = await this.prisma.workflowStatus.findFirst({
      where: { workspaceId, projectId },
      orderBy: [{ isDefault: "desc" }, { position: "asc" }, { id: "asc" }],
      ...STATUS_SELECT,
    });
    if (!status) {
      throw new BadRequestException("This project has no workflow statuses");
    }
    return status;
  }

  /**
   * "Backlog" means *not in a sprint* — the backlog view, Jira's sense. An
   * issue planned into a sprint is committed work, so a BACKLOG-category status
   * becomes the project's first UNSTARTED one; otherwise it would sit in the
   * sprint invisible, since the board shows no backlog lanes. Any other status
   * is kept.
   */
  private async committedStatus(
    workspaceId: string,
    projectId: string,
    status: StatusRef,
    sprintId: string | null | undefined,
  ): Promise<StatusRef> {
    if (!sprintId || status.category !== StatusCategory.BACKLOG) return status;

    const unstarted = await this.prisma.workflowStatus.findFirst({
      where: { workspaceId, projectId, category: StatusCategory.UNSTARTED },
      orderBy: [{ position: "asc" }, { id: "asc" }],
      ...STATUS_SELECT,
    });
    // Every workflow has one (`WorkflowService` refuses removing the last).
    return unstarted ?? status;
  }

  /**
   * Whether the project's workflow allows the move (staying put always
   * does). Both statuses were checked to be this project's.
   */
  private async canMove(fromStatusId: string, toStatusId: string) {
    if (fromStatusId === toStatusId) return true;
    const transition = await this.prisma.workflowTransition.findUnique({
      where: { fromStatusId_toStatusId: { fromStatusId, toStatusId } },
      select: { projectId: true },
    });
    return transition !== null;
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

  /**
   * The assignee as `{ id, name }` after checking they're a member; `null`
   * when unassigning, `undefined` when not sent.
   */
  private async validateAssignee(
    workspaceId: string,
    assigneeId?: string | null,
  ): Promise<Ref | null | undefined> {
    if (!assigneeId) return assigneeId === null ? null : undefined;

    const member = await this.prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: assigneeId,
          workspaceId,
        },
      },
      select: { user: { select: { id: true, name: true } } },
    });

    if (!member) {
      throw new ForbiddenException("Assignee must belong to workspace");
    }

    return member.user;
  }

  /**
   * The parent for a new sub-issue: in this workspace *and* project, and not a
   * sub-issue itself — nesting is one level deep.
   */
  private async validateParent(
    workspaceId: string,
    projectId: string,
    parentIssueId?: string,
  ) {
    if (!parentIssueId) return null;

    const parent = await this.prisma.issue.findFirst({
      where: { id: parentIssueId, workspaceId, projectId },
      select: { id: true, sprintId: true, parentIssueId: true },
    });

    if (!parent) {
      throw new ForbiddenException("Invalid parent issue");
    }
    if (parent.parentIssueId) {
      throw new BadRequestException("A sub-issue can't have sub-issues");
    }

    return parent;
  }

  /**
   * The labels, alphabetically, after checking every one is this workspace's
   * (one that isn't refuses the write); `undefined` when not sent.
   */
  private async validateLabels(
    workspaceId: string,
    labelIds?: string[],
  ): Promise<LabelRef[] | undefined> {
    if (!labelIds) return undefined;
    if (labelIds.length === 0) return [];

    const labels = await this.prisma.label.findMany({
      where: { id: { in: labelIds }, workspaceId },
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    });

    if (labels.length !== labelIds.length) {
      throw new ForbiddenException("Invalid label");
    }

    return labels;
  }

  /** Like `validateAssignee`: `{ id, name }`, `null` (backlog) or `undefined`. */
  private async validateSprint(
    workspaceId: string,
    projectId: string,
    sprintId?: string | null,
  ): Promise<Ref | null | undefined> {
    if (!sprintId) return sprintId === null ? null : undefined;

    const sprint = await this.prisma.sprint.findFirst({
      where: {
        id: sprintId,
        workspaceId,
        projectId,
      },
      select: { id: true, name: true },
    });

    if (!sprint) {
      throw new ForbiddenException("Invalid sprint assignment");
    }

    return sprint;
  }
}
