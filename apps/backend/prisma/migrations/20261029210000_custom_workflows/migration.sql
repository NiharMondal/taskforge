-- Per-project workflows (spec/workflow-spec.md): the fixed `IssueStatus` enum
-- becomes WorkflowStatus rows, one set per project, and the hard-coded
-- STATUS_TRANSITIONS become WorkflowTransition rows.
--
-- Projects that exist now keep the eight statuses and moves they had, so no
-- issue changes status and every lane keeps its order (ranks are untouched:
-- each old lane maps onto exactly one status). Projects created afterwards get
-- DEFAULT_WORKFLOW_STATUSES from @taskforge/shared instead.

-- CreateEnum
CREATE TYPE "StatusCategory" AS ENUM ('BACKLOG', 'UNSTARTED', 'STARTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "WorkflowStatus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "category" "StatusCategory" NOT NULL,
    -- A fractional-indexing key, which only sorts correctly by byte order (see
    -- issue_rank_byte_order). Prisma can't express the collation; it lives here.
    "position" TEXT COLLATE "C" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTransition" (
    "projectId" TEXT NOT NULL,
    "fromStatusId" TEXT NOT NULL,
    "toStatusId" TEXT NOT NULL,

    CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("fromStatusId","toStatusId")
);

-- CreateIndex
CREATE INDEX "WorkflowStatus_workspaceId_projectId_idx" ON "WorkflowStatus"("workspaceId", "projectId");

-- CreateIndex
CREATE INDEX "WorkflowStatus_projectId_position_idx" ON "WorkflowStatus"("projectId", "position");

-- CreateIndex
CREATE INDEX "WorkflowTransition_projectId_idx" ON "WorkflowTransition"("projectId");

-- CreateIndex
CREATE INDEX "WorkflowTransition_toStatusId_idx" ON "WorkflowTransition"("toStatusId");

-- AddForeignKey
ALTER TABLE "WorkflowStatus" ADD CONSTRAINT "WorkflowStatus_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowStatus" ADD CONSTRAINT "WorkflowStatus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_fromStatusId_fkey" FOREIGN KEY ("fromStatusId") REFERENCES "WorkflowStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_toStatusId_fkey" FOREIGN KEY ("toStatusId") REFERENCES "WorkflowStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The eight statuses every project had, keyed by the enum value they replace.
CREATE TEMP TABLE "_legacy_status" ("legacy" TEXT PRIMARY KEY, "name" TEXT, "color" TEXT, "category" TEXT, "position" TEXT, "isDefault" BOOLEAN);
INSERT INTO "_legacy_status" VALUES
  ('BACKLOG',      'Backlog',      '#6b7280', 'BACKLOG',   'a0', true),
  ('TODO',         'To Do',        '#8b5cf6', 'UNSTARTED', 'a1', false),
  ('IN_PROGRESS',  'In Progress',  '#3b82f6', 'STARTED',   'a2', false),
  ('IN_REVIEW',    'In Review',    '#eab308', 'STARTED',   'a3', false),
  ('QA_REQUESTED', 'QA Requested', '#f97316', 'STARTED',   'a4', false),
  ('QA_FAILED',    'QA Failed',    '#ef4444', 'STARTED',   'a5', false),
  ('DEPLOYED',     'Deployed',     '#14b8a6', 'STARTED',   'a6', false),
  ('DONE',         'Done',         '#22c55e', 'COMPLETED', 'a7', false);

-- The moves STATUS_TRANSITIONS allowed.
CREATE TEMP TABLE "_legacy_transition" ("from" TEXT, "to" TEXT);
INSERT INTO "_legacy_transition" VALUES
  ('BACKLOG', 'TODO'),
  ('TODO', 'IN_PROGRESS'),
  ('IN_PROGRESS', 'IN_REVIEW'),
  ('IN_REVIEW', 'QA_REQUESTED'),
  ('QA_REQUESTED', 'QA_FAILED'),
  ('QA_REQUESTED', 'DEPLOYED'),
  ('QA_FAILED', 'IN_PROGRESS'),
  ('DEPLOYED', 'DONE');

INSERT INTO "WorkflowStatus" ("id", "name", "color", "category", "position", "isDefault", "workspaceId", "projectId", "updatedAt")
SELECT gen_random_uuid()::text, l."name", l."color", l."category"::"StatusCategory", l."position", l."isDefault", p."workspaceId", p."id", CURRENT_TIMESTAMP
FROM "Project" p CROSS JOIN "_legacy_status" l;

INSERT INTO "WorkflowTransition" ("projectId", "fromStatusId", "toStatusId")
SELECT f."projectId", f."id", t."id"
FROM "_legacy_transition" lt
JOIN "_legacy_status" lf ON lf."legacy" = lt."from"
JOIN "_legacy_status" ltt ON ltt."legacy" = lt."to"
JOIN "WorkflowStatus" f ON f."name" = lf."name"
JOIN "WorkflowStatus" t ON t."name" = ltt."name" AND t."projectId" = f."projectId";

-- Point every issue at its project's status of the same name.
ALTER TABLE "Issue" ADD COLUMN "statusId" TEXT;

UPDATE "Issue" i
SET "statusId" = s."id"
FROM "_legacy_status" l, "WorkflowStatus" s
WHERE l."legacy" = i."status"::text
  AND s."projectId" = i."projectId"
  AND s."name" = l."name";

ALTER TABLE "Issue" ALTER COLUMN "statusId" SET NOT NULL;

DROP TABLE "_legacy_transition";
DROP TABLE "_legacy_status";

-- DropIndex
DROP INDEX "Issue_workspaceId_status_idx";

-- DropIndex
DROP INDEX "Issue_projectId_status_rank_idx";

-- AlterTable
ALTER TABLE "Issue" DROP COLUMN "status";

-- DropEnum
DROP TYPE "IssueStatus";

-- CreateIndex
CREATE INDEX "Issue_workspaceId_statusId_idx" ON "Issue"("workspaceId", "statusId");

-- CreateIndex
CREATE INDEX "Issue_projectId_statusId_rank_idx" ON "Issue"("projectId", "statusId", "rank");

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "WorkflowStatus"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
