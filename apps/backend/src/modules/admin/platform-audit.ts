import {
  PLATFORM_AUDIT_ACTION_TARGET,
  type PlatformAuditAction,
  type PlatformAuditMetadata,
} from "@taskforge/shared";
import type { Prisma } from "generated/prisma/client";

/**
 * The platform audit log (`spec/admin-spec.md`): what platform staff, or the
 * `set-platform-role` script, did. Kept apart from `AuditLog`, which belongs to
 * one workspace. The actions, their target types and each one's `metadata`
 * are in `@taskforge/shared` (`admin.ts`), which the web reads them with.
 * Write a row with the transaction client of the change itself, so the log
 * can't disagree with it; names are copied in so a row still reads after the
 * target is deleted.
 */
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
      targetType: PLATFORM_AUDIT_ACTION_TARGET[entry.action],
      targetId: entry.targetId,
      metadata: entry.metadata,
    },
  });
}
