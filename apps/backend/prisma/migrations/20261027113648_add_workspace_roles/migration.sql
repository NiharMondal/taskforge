-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "roleId" TEXT;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "roleId" TEXT;

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemKey" "WorkspaceRole",
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_workspaceId_name_key" ON "Role"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Role_workspaceId_systemKey_key" ON "Role"("workspaceId", "systemKey");

-- CreateIndex
CREATE INDEX "Invitation_roleId_idx" ON "Invitation"("roleId");

-- CreateIndex
CREATE INDEX "Membership_roleId_idx" ON "Membership"("roleId");

-- Seed the four built-in roles into every existing workspace. Must match
-- DEFAULT_ROLE_PERMISSIONS / SYSTEM_ROLE_NAMES in
-- src/common/permissions/permissions.ts. OWNER's list is empty on purpose: the
-- owner is granted every permission in code.
INSERT INTO "Role" ("id", "workspaceId", "name", "systemKey", "permissions", "updatedAt")
SELECT gen_random_uuid()::text, w."id", v."name", v."key"::"WorkspaceRole", v."perms"::text[], CURRENT_TIMESTAMP
FROM "Workspace" w
CROSS JOIN (VALUES
  ('Owner',  'OWNER',  '{}'),
  ('Admin',  'ADMIN',  '{workspace:manage,project:manage,sprint:manage,issue:create,issue:delete,issue:edit:any,issue:edit:own,issue:status,issue:status:done,member:manage,invitation:manage,role:manage}'),
  ('Member', 'MEMBER', '{issue:create,issue:edit:own,issue:status}'),
  ('Viewer', 'VIEWER', '{}')
) AS v("name", "key", "perms");

-- Point every membership and invitation at its workspace's matching role.
UPDATE "Membership" m
SET "roleId" = r."id"
FROM "Role" r
WHERE r."workspaceId" = m."workspaceId" AND r."systemKey" = m."role";

UPDATE "Invitation" i
SET "roleId" = r."id"
FROM "Role" r
WHERE r."workspaceId" = i."workspaceId" AND r."systemKey" = i."role";

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
