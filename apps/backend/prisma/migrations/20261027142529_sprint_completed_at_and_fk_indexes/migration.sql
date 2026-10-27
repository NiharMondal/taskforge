-- DropIndex
DROP INDEX "Invitation_token_idx";

-- AlterTable
ALTER TABLE "Sprint" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Issue_sprintId_idx" ON "Issue"("sprintId");

-- CreateIndex
CREATE INDEX "Issue_parentIssueId_idx" ON "Issue"("parentIssueId");

-- CreateIndex
CREATE INDEX "IssueLabel_labelId_idx" ON "IssueLabel"("labelId");
