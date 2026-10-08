import { PrismaService } from "@/prisma/prisma.service";
import { ForbiddenException } from "@nestjs/common";
import { IssueStatus, WorkspaceRole } from "generated/prisma/enums";
import { IssueService } from "./issue.service";

describe("IssueService.update role rules", () => {
  const workspaceId = "ws-1";
  const projectId = "proj-1";
  const issueId = "issue-1";

  let prisma: { issue: { findFirst: jest.Mock; update: jest.Mock } };
  let service: IssueService;

  beforeEach(() => {
    prisma = {
      issue: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: issueId, status: IssueStatus.BACKLOG }),
        update: jest.fn().mockResolvedValue({ id: issueId }),
      },
    };
    service = new IssueService(prisma as unknown as PrismaService);
  });

  const update = (role: WorkspaceRole, dto: object) =>
    service.update(workspaceId, projectId, issueId, role, dto);

  describe("VIEWER", () => {
    it.each([
      ["title", { title: "Hijacked" }],
      ["description", { description: "Hijacked" }],
      ["status", { status: IssueStatus.DONE }],
      ["priority", { priority: "HIGH" }],
      ["rank", { rank: "a1" }],
      ["an empty body", {}],
    ])("is rejected when updating %s", async (_label, dto) => {
      await expect(update(WorkspaceRole.VIEWER, dto)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("is rejected before anything is read or written", async () => {
      await expect(
        update(WorkspaceRole.VIEWER, { title: "Hijacked" }),
      ).rejects.toThrow();

      expect(prisma.issue.findFirst).not.toHaveBeenCalled();
      expect(prisma.issue.update).not.toHaveBeenCalled();
    });
  });

  describe("MEMBER", () => {
    it("may still change status", async () => {
      await update(WorkspaceRole.MEMBER, { status: IssueStatus.IN_PROGRESS });

      expect(prisma.issue.update).toHaveBeenCalledTimes(1);
    });

    it("may not change restricted fields", async () => {
      await expect(
        update(WorkspaceRole.MEMBER, { title: "Renamed" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.issue.update).not.toHaveBeenCalled();
    });

    it("may not mark an issue DONE", async () => {
      await expect(
        update(WorkspaceRole.MEMBER, { status: IssueStatus.DONE }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.issue.update).not.toHaveBeenCalled();
    });
  });

  describe.each([WorkspaceRole.ADMIN, WorkspaceRole.OWNER])("%s", (role) => {
    it("may update any field", async () => {
      await update(role, { title: "Renamed", status: IssueStatus.DONE });

      expect(prisma.issue.update).toHaveBeenCalledTimes(1);
    });
  });
});
