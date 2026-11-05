import { assertCanCustomizeWorkflow } from "@/common/plans/plan-limits";
import {
  IssueActivity,
  recordIssueActivity,
} from "@/modules/activity/issue-activity";
import { lastRankInLane, lockIssueLane } from "@/modules/issues/issue-lane";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  isValidRank,
  MAX_WORKFLOW_STATUSES,
  rankBetween,
  ranksBetween,
  REQUIRED_STATUS_CATEGORIES,
} from "@taskforge/shared";
import type { Prisma } from "generated/prisma/client";
import { StatusCategory } from "generated/prisma/enums";
import {
  CreateWorkflowStatusDto,
  UpdateWorkflowStatusDto,
} from "./dto/workflow-status.dto";
import { ReplaceTransitionsDto } from "./dto/replace-transitions.dto";

/** What a status read returns (plus `issueCount` on `GET`). */
const STATUS_FIELDS = {
  id: true,
  name: true,
  color: true,
  category: true,
  position: true,
  isDefault: true,
} as const;

type Status = Prisma.WorkflowStatusGetPayload<{
  select: typeof STATUS_FIELDS;
}>;

const CATEGORY_NAMES: Record<StatusCategory, string> = {
  BACKLOG: "backlog",
  UNSTARTED: "unstarted",
  STARTED: "started",
  COMPLETED: "completed",
};

/** Column order: by position, then id, so equal keys still sort the same way. */
const byPosition = (a: Status, b: Status) =>
  a.position < b.position
    ? -1
    : a.position > b.position
      ? 1
      : a.id.localeCompare(b.id);

/**
 * Refuse a workflow that would leave sprint planning or finishing work with
 * nowhere to go (see `REQUIRED_STATUS_CATEGORIES`).
 */
function assertUsable(statuses: Pick<Status, "category">[]) {
  for (const category of REQUIRED_STATUS_CATEGORIES) {
    if (!statuses.some((s) => s.category === category)) {
      throw new ConflictException(
        `A workflow needs at least one ${CATEGORY_NAMES[category]} status`,
      );
    }
  }
}

/** Names are unique in the project, ignoring case. */
function assertNameFree(statuses: Status[], name: string, exceptId?: string) {
  const taken = statuses.some(
    (s) => s.id !== exceptId && s.name.toLowerCase() === name.toLowerCase(),
  );
  if (taken) {
    throw new ConflictException(`A status named "${name}" already exists`);
  }
}

/** A key after every status's, putting a status last. */
function appendPosition(statuses: Status[]) {
  const last = statuses
    .map((s) => s.position)
    .filter(isValidRank)
    .reduce<string | null>(
      (max, p) => (max === null || p > max ? p : max),
      null,
    );
  return rankBetween(last, null)!;
}

/**
 * `position`, or — when another status already holds it (the client worked from
 * a stale list) — a key between that status and the next, so both stay
 * orderable. Like `IssueService.freeRank`, for columns.
 */
function freePosition(others: Status[], position: string) {
  if (!isValidRank(position)) {
    throw new BadRequestException("Invalid status position");
  }
  if (!others.some((s) => s.position === position)) return position;

  const next = others
    .map((s) => s.position)
    .filter((p) => p > position && isValidRank(p))
    .sort()[0];
  return rankBetween(position, next) ?? appendPosition(others);
}

@Injectable()
export class WorkflowService {
  constructor(private prisma: PrismaService) {}

  /** The project's statuses in column order, and the moves between them. */
  async find(workspaceId: string, projectId: string) {
    await this.validateProject(workspaceId, projectId);

    const [statuses, transitions] = await Promise.all([
      this.prisma.workflowStatus.findMany({
        where: { workspaceId, projectId },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: { ...STATUS_FIELDS, _count: { select: { issues: true } } },
      }),
      this.prisma.workflowTransition.findMany({
        where: { projectId, project: { workspaceId } },
        select: { fromStatusId: true, toStatusId: true },
      }),
    ]);

    return {
      statuses: statuses.map(({ _count, ...status }) => ({
        ...status,
        issueCount: _count.issues,
      })),
      transitions,
    };
  }

  createStatus(
    workspaceId: string,
    projectId: string,
    dto: CreateWorkflowStatusDto,
  ) {
    return this.edit(workspaceId, projectId, async (tx, statuses) => {
      if (statuses.length >= MAX_WORKFLOW_STATUSES) {
        throw new ConflictException(
          `A workflow can have at most ${MAX_WORKFLOW_STATUSES} statuses`,
        );
      }
      assertNameFree(statuses, dto.name);

      return tx.workflowStatus.create({
        data: {
          name: dto.name,
          color: dto.color,
          category: dto.category,
          position:
            dto.position === undefined
              ? appendPosition(statuses)
              : freePosition(statuses, dto.position),
          workspaceId,
          projectId,
        },
        select: STATUS_FIELDS,
      });
    });
  }

  async updateStatus(
    workspaceId: string,
    projectId: string,
    statusId: string,
    dto: UpdateWorkflowStatusDto,
  ) {
    if (dto.isDefault === false) {
      throw new BadRequestException(
        "A project always has a default status: make another status the default instead",
      );
    }

    return this.edit(workspaceId, projectId, async (tx, statuses) => {
      const status = this.pick(statuses, statusId);
      const others = statuses.filter((s) => s.id !== statusId);

      if (dto.name !== undefined) assertNameFree(statuses, dto.name, statusId);
      if (dto.category !== undefined) {
        assertUsable([...others, { category: dto.category }]);
      }
      if (dto.isDefault && !status.isDefault) {
        await tx.workflowStatus.updateMany({
          where: { workspaceId, projectId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.workflowStatus.update({
        where: { id: statusId },
        data: {
          name: dto.name,
          color: dto.color,
          category: dto.category,
          position:
            dto.position === undefined
              ? undefined
              : freePosition(others, dto.position),
          isDefault: dto.isDefault,
        },
        select: STATUS_FIELDS,
      });
    });
  }

  /**
   * Delete a status. Its issues, if any, go to `moveTo` — appended to that
   * lane in their order, each with a history row — without a transition check:
   * an admin is reshaping the workflow, not moving work along it.
   */
  deleteStatus(
    workspaceId: string,
    projectId: string,
    statusId: string,
    userId: string,
    moveTo?: string,
  ) {
    return this.edit(workspaceId, projectId, async (tx, statuses) => {
      const status = this.pick(statuses, statusId);
      if (status.isDefault) {
        throw new ConflictException(
          "Make another status the default before deleting this one",
        );
      }
      assertUsable(statuses.filter((s) => s.id !== statusId));

      const target =
        moveTo === undefined ? undefined : this.pick(statuses, moveTo);
      if (target?.id === statusId) {
        throw new BadRequestException(
          "Move the issues to a status other than the one being deleted",
        );
      }

      // Hold the lane being emptied, so no card lands in it after the count.
      await lockIssueLane(tx, projectId, statusId);
      const issues = await tx.issue.findMany({
        where: { workspaceId, projectId, statusId },
        orderBy: [
          { rank: { sort: "asc", nulls: "last" } },
          { createdAt: "asc" },
        ],
        select: { id: true },
      });

      if (issues.length > 0) {
        if (!target) {
          throw new ConflictException(
            "This status still has issues: choose a status to move them to",
          );
        }
        await this.moveIssues(
          tx,
          { workspaceId, projectId, userId },
          issues,
          status,
          target,
        );
      }

      await tx.workflowStatus.delete({ where: { id: statusId } });
      return status;
    });
  }

  /** Replace every move the project allows. */
  replaceTransitions(
    workspaceId: string,
    projectId: string,
    dto: ReplaceTransitionsDto,
  ) {
    return this.edit(workspaceId, projectId, async (tx, statuses) => {
      const ids = new Set(statuses.map((s) => s.id));
      const seen = new Set<string>();

      for (const { fromStatusId, toStatusId } of dto.transitions) {
        if (!ids.has(fromStatusId) || !ids.has(toStatusId)) {
          throw new BadRequestException(
            "A transition names a status that isn't this project's",
          );
        }
        if (fromStatusId === toStatusId) {
          throw new BadRequestException(
            "A status can't have a transition to itself",
          );
        }
        const pair = `${fromStatusId}:${toStatusId}`;
        if (seen.has(pair)) {
          throw new BadRequestException("A transition is listed twice");
        }
        seen.add(pair);
      }

      await tx.workflowTransition.deleteMany({ where: { projectId } });
      await tx.workflowTransition.createMany({
        data: dto.transitions.map((t) => ({
          fromStatusId: t.fromStatusId,
          toStatusId: t.toStatusId,
          projectId,
        })),
      });
      return dto.transitions.map((t) => ({
        fromStatusId: t.fromStatusId,
        toStatusId: t.toStatusId,
      }));
    });
  }

  /**
   * Every write: the project must be in the workspace, the plan must allow
   * custom workflows, and writes to one project queue on a lock — two deletes
   * at once could otherwise each remove one of the last two completed
   * statuses. `write` gets the statuses as they are under the lock.
   */
  private async edit<T>(
    workspaceId: string,
    projectId: string,
    write: (tx: Prisma.TransactionClient, statuses: Status[]) => Promise<T>,
  ) {
    await this.validateProject(workspaceId, projectId);

    return this.prisma.$transaction(async (tx) => {
      const lock = `workflow:${projectId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}::text, 0))`;
      await assertCanCustomizeWorkflow(tx, workspaceId);

      const statuses = await tx.workflowStatus.findMany({
        where: { workspaceId, projectId },
        select: STATUS_FIELDS,
      });
      return write(tx, statuses.sort(byPosition));
    });
  }

  /** Append `issues`, in order, to `target`'s lane, recording each move. */
  private async moveIssues(
    tx: Prisma.TransactionClient,
    {
      workspaceId,
      projectId,
      userId,
    }: { workspaceId: string; projectId: string; userId: string },
    issues: { id: string }[],
    from: Status,
    target: Status,
  ) {
    await lockIssueLane(tx, projectId, target.id);
    const last = await lastRankInLane(tx, {
      workspaceId,
      projectId,
      statusId: target.id,
    });
    const ranks = ranksBetween(last, null, issues.length);

    for (const [i, issue] of issues.entries()) {
      await tx.issue.update({
        where: { id: issue.id },
        data: { statusId: target.id, rank: ranks[i] },
      });
      await recordIssueActivity(tx, {
        workspaceId,
        issueId: issue.id,
        userId,
        action: IssueActivity.updated,
        metadata: {
          changes: [{ field: "status", from: from.name, to: target.name }],
        },
      });
    }
  }

  /** A status of this project, from the list `edit` read; else 404. */
  private pick(statuses: Status[], statusId: string) {
    const status = statuses.find((s) => s.id === statusId);
    if (!status) {
      throw new NotFoundException("Status not found");
    }
    return status;
  }

  private async validateProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }
  }
}
