-- Grant the comment permissions to the built-in roles of workspaces that
-- existed before them. Must match DEFAULT_ROLE_PERMISSIONS in
-- src/common/permissions/permissions.ts, which seeds new workspaces: Admin
-- gets both keys, Member gets `comment:create`, Viewer gets neither. OWNER
-- holds every permission in code. No schema change.
UPDATE "Role"
SET "permissions" = array_append("permissions", 'comment:create'),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "systemKey" IN ('ADMIN', 'MEMBER')
  AND NOT ('comment:create' = ANY("permissions"));

UPDATE "Role"
SET "permissions" = array_append("permissions", 'comment:delete:any'),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "systemKey" = 'ADMIN'
  AND NOT ('comment:delete:any' = ANY("permissions"));
