import { PrismaService } from "@/prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";
import { ActivityService } from "./activity.service";

describe("ActivityService", () => {
  const workspaceId = "ws-1";
  const projectId = "proj-1";
  const issueId = "issue-1";

  let prisma: {
    issue: { findFirst: jest.Mock };
    auditLog: { findMany: jest.Mock };
  };
  let service: ActivityService;

  beforeEach(() => {
    prisma = {
      issue: { findFirst: jest.fn().mockResolvedValue({ id: issueId }) },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new ActivityService(prisma as unknown as PrismaService);
  });

  it("reads only this workspace's rows for this issue, oldest first", async () => {
    await service.findForIssue(workspaceId, projectId, issueId);

    expect(prisma.issue.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: issueId, workspaceId, projectId },
      }),
    );
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId, entityType: "ISSUE", entityId: issueId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("404s an issue outside the workspace or project, reading nothing", async () => {
    prisma.issue.findFirst.mockResolvedValue(null);

    await expect(
      service.findForIssue(workspaceId, projectId, issueId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
  });
});
