-- Issue history reads AuditLog by (workspaceId, entityType, entityId) in
-- createdAt order. The new index's prefix also serves workspace-only lookups,
-- so it replaces the single-column one.

-- DropIndex
DROP INDEX "AuditLog_workspaceId_idx";

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_entityType_entityId_createdAt_idx" ON "AuditLog"("workspaceId", "entityType", "entityId", "createdAt");
