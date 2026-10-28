-- Grant `label:manage` to the built-in Admin role of workspaces that existed
-- before it. Must match DEFAULT_ROLE_PERMISSIONS in
-- src/common/permissions/permissions.ts, which seeds new workspaces: Admin
-- gets it, Member and Viewer don't. OWNER holds every permission in code.
-- No schema change.
UPDATE "Role"
SET "permissions" = array_append("permissions", 'label:manage'),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "systemKey" = 'ADMIN'
  AND NOT ('label:manage' = ANY("permissions"));
