import {
  AUDIT_ACTION_ENTITY,
  SYSTEM_ROLE_NAMES,
  type AuditAction,
  type AuditMetadata,
  type AuditRef,
  type WorkspaceRole,
} from "@taskforge/shared";
import type { Prisma } from "generated/prisma/client";

/**
 * The workspace audit log (`spec/activity-spec.md`): who changed membership,
 * invitations, roles, the workspace or its plan. Stored as `AuditLog` rows
 * next to issue history, with the entity type the action implies
 * (`AUDIT_ACTION_ENTITY` in `@taskforge/shared`). Always write the row with the
 * transaction client of the change itself, so the log can't disagree with it.
 * Names are copied into `metadata`, so a row still reads after a rename or a
 * delete.
 */
export function recordWorkspaceEvent<A extends AuditAction>(
  db: Pick<Prisma.TransactionClient, "auditLog">,
  entry: {
    workspaceId: string;
    /** Who did it; `null` for the system (a Stripe webhook). */
    userId: string | null;
    action: A;
    entityId: string | null;
    metadata: AuditMetadata[A];
  },
) {
  return db.auditLog.create({
    data: {
      workspaceId: entry.workspaceId,
      userId: entry.userId,
      action: entry.action,
      entityType: AUDIT_ACTION_ENTITY[entry.action],
      entityId: entry.entityId,
      metadata: entry.metadata,
    },
  });
}

/**
 * A role as the log names it: the Role row, or, for a membership predating
 * role rows, the built-in its enum stands for.
 */
export function roleRef(
  assigned: { id: string; name: string } | null | undefined,
  enumRole: WorkspaceRole,
): AuditRef {
  return assigned
    ? { id: assigned.id, name: assigned.name }
    : { id: null, name: SYSTEM_ROLE_NAMES[enumRole] };
}
