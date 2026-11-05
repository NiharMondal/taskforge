-- The workspace audit log (spec/activity-spec.md): an index for reading a
-- workspace's rows newest first, and the new `audit:read` permission for the
-- built-in Admin role of workspaces that existed before it. Must match
-- DEFAULT_ROLE_PERMISSIONS in @taskforge/shared, which seeds new workspaces:
-- Admin gets it, Member and Viewer don't. OWNER holds every permission in code.

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");


UPDATE "Role"
SET "permissions" = array_append("permissions", 'audit:read'),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "systemKey" = 'ADMIN'
  AND NOT ('audit:read' = ANY("permissions"));
