import { PrismaService } from "@/prisma/prisma.service";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
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

describe("IssueService tenant isolation", () => {
  const workspaceId = "ws-A";
  const projectId = "proj-A";

  let prisma: {
    issue: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    project: { findFirst: jest.Mock };
    membership: { findUnique: jest.Mock };
    sprint: { findFirst: jest.Mock };
  };
  let service: IssueService;

  beforeEach(() => {
    prisma = {
      // Nothing matches by default: every row "belongs to another workspace".
      issue: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      project: { findFirst: jest.fn().mockResolvedValue(null) },
      membership: { findUnique: jest.fn().mockResolvedValue(null) },
      sprint: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    service = new IssueService(prisma as unknown as PrismaService);
  });

  it("scopes a single-issue read to the workspace and project", async () => {
    await expect(
      service.findOne(workspaceId, projectId, "issue-B"),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.issue.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "issue-B", workspaceId, projectId },
      }),
    );
  });

  it("cannot update another workspace's issue, and writes nothing", async () => {
    await expect(
      service.update(workspaceId, projectId, "issue-B", WorkspaceRole.OWNER, {
        title: "Hijacked",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.issue.update).not.toHaveBeenCalled();
  });

  it("cannot delete another workspace's issue", async () => {
    await expect(
      service.remove(workspaceId, projectId, "issue-B"),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.issue.delete).not.toHaveBeenCalled();
  });

  describe("create", () => {
    const create = (dto: object) =>
      service.create(workspaceId, projectId, "user-A", {
        title: "New",
        ...dto,
      });

    it("refuses a project from another workspace", async () => {
      await expect(create({})).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: projectId, workspaceId },
      });
      expect(prisma.issue.create).not.toHaveBeenCalled();
    });

    it("refuses an assignee who is not a member of this workspace", async () => {
      prisma.project.findFirst.mockResolvedValue({ id: projectId });

      await expect(create({ assigneeId: "user-B" })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.membership.findUnique).toHaveBeenCalledWith({
        where: { userId_workspaceId: { userId: "user-B", workspaceId } },
      });
      expect(prisma.issue.create).not.toHaveBeenCalled();
    });

    it("refuses a sprint from another workspace or project", async () => {
      prisma.project.findFirst.mockResolvedValue({ id: projectId });

      await expect(create({ sprintId: "sprint-B" })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.sprint.findFirst).toHaveBeenCalledWith({
        where: { id: "sprint-B", workspaceId, projectId },
      });
      expect(prisma.issue.create).not.toHaveBeenCalled();
    });
  });
});
