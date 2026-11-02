import type { Prisma } from "generated/prisma/client";
import type { PlatformRole } from "generated/prisma/enums";

/**
 * The platform audit log (`spec/admin-spec.md`): what platform staff, or the
 * `set-platform-role` script, did. Kept apart from `AuditLog`, which belongs to
 * one workspace. Write a row with the transaction client of the change itself,
 * so the log can't disagree with it.
 */

/** Each action and the `metadata` its row carries. */
export interface PlatformAuditMetadata {
  /** A user's platform role was granted, changed or removed. */
  "platform_role.changed": {
    email: string;
    from: PlatformRole | null;
    to: PlatformRole | null;
  };
}

export type PlatformAuditAction = keyof PlatformAuditMetadata;

/** What an action is about. */
export const PLATFORM_AUDIT_TARGET: Record<
  PlatformAuditAction,
  "USER" | "WORKSPACE"
> = {
  "platform_role.changed": "USER",
};

export function recordPlatformEvent<A extends PlatformAuditAction>(
  db: Pick<Prisma.TransactionClient, "platformAuditLog">,
  entry: {
    /** Platform staff who did it; `null` for the CLI script. */
    actorId: string | null;
    action: A;
    targetId: string;
    metadata: PlatformAuditMetadata[A];
  },
) {
  return db.platformAuditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: PLATFORM_AUDIT_TARGET[entry.action],
      targetId: entry.targetId,
      metadata: entry.metadata,
    },
  });
}
