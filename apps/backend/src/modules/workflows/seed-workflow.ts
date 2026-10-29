import {
  allTransitions,
  DEFAULT_WORKFLOW_STATUSES,
  ranksBetween,
} from "@taskforge/shared";
import { randomUUID } from "node:crypto";
import type { Prisma } from "generated/prisma/client";

type Db = Pick<
  Prisma.TransactionClient,
  "workflowStatus" | "workflowTransition"
>;

/**
 * Give a new project the default workflow (`DEFAULT_WORKFLOW_STATUSES`, every
 * move allowed). Run it in the transaction that creates the project, as
 * `seedSystemRoles` runs in the one that creates a workspace.
 */
export async function seedDefaultWorkflow(
  db: Db,
  workspaceId: string,
  projectId: string,
) {
  const positions = ranksBetween(null, null, DEFAULT_WORKFLOW_STATUSES.length);
  const statuses = DEFAULT_WORKFLOW_STATUSES.map((status, i) => ({
    id: randomUUID(),
    name: status.name,
    color: status.color,
    category: status.category,
    position: positions[i],
    isDefault: status.isDefault ?? false,
    workspaceId,
    projectId,
  }));

  await db.workflowStatus.createMany({ data: statuses });
  await db.workflowTransition.createMany({
    data: allTransitions(statuses.map((s) => s.id)).map((t) => ({
      ...t,
      projectId,
    })),
  });
}

/**
 * Give a new project a copy of another project's workflow: the same statuses
 * (new ids), order, default and moves. The caller has checked `fromProjectId`
 * is in the workspace; the reads filter on it anyway.
 */
export async function copyWorkflow(
  db: Db,
  workspaceId: string,
  fromProjectId: string,
  toProjectId: string,
) {
  const [statuses, transitions] = await Promise.all([
    db.workflowStatus.findMany({
      where: { workspaceId, projectId: fromProjectId },
    }),
    db.workflowTransition.findMany({
      where: { projectId: fromProjectId, project: { workspaceId } },
    }),
  ]);
  const newId = new Map(statuses.map((s) => [s.id, randomUUID()]));

  await db.workflowStatus.createMany({
    data: statuses.map((status) => ({
      id: newId.get(status.id)!,
      name: status.name,
      color: status.color,
      category: status.category,
      position: status.position,
      isDefault: status.isDefault,
      workspaceId,
      projectId: toProjectId,
    })),
  });
  await db.workflowTransition.createMany({
    data: transitions.map((t) => ({
      fromStatusId: newId.get(t.fromStatusId)!,
      toStatusId: newId.get(t.toStatusId)!,
      projectId: toProjectId,
    })),
  });
}
