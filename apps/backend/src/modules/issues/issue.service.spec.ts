import { accessAs } from "@/common/permissions/test-access";
import { WorkspaceAccess } from "@/common/permissions/workspace-access";
import { PrismaService } from "@/prisma/prisma.service";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { IssueStatus, WorkspaceRole } from "generated/prisma/enums";
import { IssueService } from "./issue.service";

describe("IssueService.update permission rules", () => {
  const workspaceId = "ws-1";
  const projectId = "proj-1";
  const issueId = "issue-1";
  const me = "user-me";

  /** The issue as stored; nobody involved is `me` unless a test says so. */
  let stored: { reporterId: string; assigneeId: string | null };
  let prisma: { issue: { findFirst: jest.Mock; update: jest.Mock } };
  let service: IssueService;

  beforeEach(() => {
    stored = { reporterId: "user-other", assigneeId: null };
    prisma = {
      issue: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: issueId,
            status: IssueStatus.BACKLOG,
            ...stored,
          }),
        ),
        update: jest.fn().mockResolvedValue({ id: issueId }),
      },
    };
    service = new IssueService(prisma as unknown as PrismaService);
  });

  const as = (role: WorkspaceRole) =>
    accessAs(role, { workspaceId, userId: me });
  const update = (access: WorkspaceAccess, dto: object) =>
    service.update(workspaceId, projectId, issueId, access, dto);
  const refused = async (access: WorkspaceAccess, dto: object) => {
    await expect(update(access, dto)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.issue.update).not.toHaveBeenCalled();
  };

  describe("VIEWER", () => {
    it.each([
      ["title", { title: "Hijacked" }],
      ["description", { description: "Hijacked" }],
      ["status", { status: IssueStatus.DONE }],
      ["priority", { priority: "HIGH" }],
      ["rank", { rank: "a1" }],
      ["an empty body", {}],
    ])("is rejected when updating %s", async (_label, dto) => {
      await refused(as(WorkspaceRole.VIEWER), dto);
    });

    it("is rejected before anything is read or written", async () => {
      await expect(
        update(as(WorkspaceRole.VIEWER), { title: "Hijacked" }),
      ).rejects.toThrow();

      expect(prisma.issue.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("MEMBER on someone else's issue", () => {
    it("may change status and board position", async () => {
      await update(as(WorkspaceRole.MEMBER), {
        status: IssueStatus.IN_PROGRESS,
        rank: "a1",
      });

      expect(prisma.issue.update).toHaveBeenCalledTimes(1);
    });

    it.each([
      // H3: description used to slip past a deny-list of restricted fields.
      ["description", { description: "Rewritten" }],
      ["title", { title: "Renamed" }],
      ["priority", { priority: "HIGH" }],
      ["sprintId", { sprintId: "sprint-1" }],
      ["assigneeId", { assigneeId: "user-x" }],
    ])("may not change %s", async (_label, dto) => {
      await refused(as(WorkspaceRole.MEMBER), dto);
    });

    it("can't make the issue theirs by assigning themselves in the same PATCH", async () => {
      await refused(as(WorkspaceRole.MEMBER), {
        assigneeId: me,
        title: "Mine now",
      });
    });

    it("may not mark it DONE", async () => {
      await refused(as(WorkspaceRole.MEMBER), { status: IssueStatus.DONE });
    });
  });

  describe.each([
    ["reported", () => (stored.reporterId = me)],
    ["is assigned to", () => (stored.assigneeId = me)],
  ])("MEMBER on an issue they %s", (_label, makeMine) => {
    beforeEach(makeMine);

    it("may edit every content field", async () => {
      await update(as(WorkspaceRole.MEMBER), {
        title: "Renamed",
        description: "Rewritten",
        priority: "HIGH",
      });

      expect(prisma.issue.update).toHaveBeenCalledTimes(1);
    });

    it("still may not mark it DONE", async () => {
      await refused(as(WorkspaceRole.MEMBER), { status: IssueStatus.DONE });
    });
  });

  describe.each([WorkspaceRole.ADMIN, WorkspaceRole.OWNER])("%s", (role) => {
    it("may update any field on any issue, including DONE", async () => {
      await update(as(role), {
        title: "Renamed",
        description: "Rewritten",
        status: IssueStatus.DONE,
      });

      expect(prisma.issue.update).toHaveBeenCalledTimes(1);
    });
  });

  it("refuses a field nobody has been allowed to write", async () => {
    await refused(as(WorkspaceRole.OWNER), { reporterId: "user-x" });
  });
});

describe("IssueService.create permission rules", () => {
  let prisma: {
    issue: { create: jest.Mock; findFirst: jest.Mock };
    project: { findFirst: jest.Mock };
  };
  let service: IssueService;

  beforeEach(() => {
    prisma = {
      issue: {
        create: jest.fn().mockResolvedValue({ id: "issue-new" }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      project: { findFirst: jest.fn().mockResolvedValue({ id: "proj-1" }) },
    };
    service = new IssueService(prisma as unknown as PrismaService);
  });

  const create = (role: WorkspaceRole, dto: object) =>
    service.create("ws-1", "proj-1", "user-me", accessAs(role), {
      title: "New",
      ...dto,
    });

  it("lets a MEMBER create an issue", async () => {
    await create(WorkspaceRole.MEMBER, { status: IssueStatus.TODO });

    expect(prisma.issue.create).toHaveBeenCalledTimes(1);
  });

  it("refuses a MEMBER creating it straight into DONE", async () => {
    await expect(
      create(WorkspaceRole.MEMBER, { status: IssueStatus.DONE }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.issue.create).not.toHaveBeenCalled();
  });

  it("lets an ADMIN create it straight into DONE", async () => {
    await create(WorkspaceRole.ADMIN, { status: IssueStatus.DONE });

    expect(prisma.issue.create).toHaveBeenCalledTimes(1);
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
      service.update(
        workspaceId,
        projectId,
        "issue-B",
        accessAs(WorkspaceRole.OWNER, { workspaceId }),
        { title: "Hijacked" },
      ),
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
      service.create(
        workspaceId,
        projectId,
        "user-A",
        accessAs(WorkspaceRole.OWNER, { workspaceId }),
        { title: "New", ...dto },
      );

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
