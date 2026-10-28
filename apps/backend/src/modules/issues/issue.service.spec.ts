import { accessAs } from "@/common/permissions/test-access";
import { WorkspaceAccess } from "@/common/permissions/workspace-access";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { IssueStatus, IssueType, WorkspaceRole } from "generated/prisma/enums";
import { IssueService } from "./issue.service";

describe("IssueService.update permission rules", () => {
  const workspaceId = "ws-1";
  const projectId = "proj-1";
  const issueId = "issue-1";
  const me = "user-me";

  /** The issue as stored; nobody involved is `me` unless a test says so. */
  let stored: {
    status: IssueStatus;
    reporterId: string;
    assigneeId: string | null;
  };
  let prisma: {
    issue: { findFirst: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let service: IssueService;

  beforeEach(() => {
    stored = {
      status: IssueStatus.TODO,
      reporterId: "user-other",
      assigneeId: null,
    };
    prisma = {
      issue: {
        findFirst: jest.fn(() => Promise.resolve({ id: issueId, ...stored })),
        update: jest.fn().mockResolvedValue({ id: issueId }),
      },
      $transaction: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );
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
      stored.status = IssueStatus.DEPLOYED;
      await update(as(role), {
        title: "Renamed",
        description: "Rewritten",
        status: IssueStatus.DONE,
      });

      expect(prisma.issue.update).toHaveBeenCalledTimes(1);
    });
  });

  describe("status changes follow the workflow", () => {
    it.each([
      [IssueStatus.TODO, IssueStatus.DONE],
      [IssueStatus.TODO, IssueStatus.IN_REVIEW],
      [IssueStatus.IN_PROGRESS, IssueStatus.TODO],
      [IssueStatus.DONE, IssueStatus.DEPLOYED],
    ])("refuses %s → %s, even for the OWNER", async (from, to) => {
      stored.status = from;

      await expect(
        update(as(WorkspaceRole.OWNER), { status: to }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.issue.update).not.toHaveBeenCalled();
    });

    it.each([
      [IssueStatus.QA_REQUESTED, IssueStatus.DEPLOYED],
      [IssueStatus.QA_REQUESTED, IssueStatus.QA_FAILED],
      [IssueStatus.QA_FAILED, IssueStatus.IN_PROGRESS],
      [IssueStatus.IN_REVIEW, IssueStatus.IN_REVIEW],
    ])("allows %s → %s", async (from, to) => {
      stored.status = from;

      await update(as(WorkspaceRole.OWNER), { status: to, rank: "a1" });

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
    project: { findFirst: jest.Mock; update: jest.Mock };
    sprint: { findFirst: jest.Mock };
    $transaction: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let service: IssueService;

  beforeEach(() => {
    prisma = {
      issue: {
        create: jest.fn().mockResolvedValue({ id: "issue-new" }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      project: {
        findFirst: jest.fn().mockResolvedValue({ id: "proj-1" }),
        update: jest.fn().mockResolvedValue({ issueCounter: 7 }),
      },
      sprint: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );
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

  it("numbers the issue from the project's counter", async () => {
    await create(WorkspaceRole.ADMIN, {});

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: "proj-1" },
      data: { issueCounter: { increment: 1 } },
      select: { issueCounter: true },
    });
    expect(prisma.issue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ number: 7 }) as unknown,
      }),
    );
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

  describe("sub-issues", () => {
    const createdData = () =>
      (
        prisma.issue.create.mock.calls[0] as [{ data: Record<string, unknown> }]
      )[0].data;

    it("types a sub-issue SUBTASK and starts it in the parent's sprint", async () => {
      prisma.issue.findFirst.mockResolvedValueOnce({
        id: "parent-1",
        sprintId: "sprint-1",
        parentIssueId: null,
      });

      await create(WorkspaceRole.MEMBER, { parentIssueId: "parent-1" });

      expect(createdData()).toMatchObject({
        parentIssueId: "parent-1",
        type: IssueType.SUBTASK,
        sprintId: "sprint-1",
      });
    });

    it("keeps a sprint chosen for the sub-issue over the parent's", async () => {
      prisma.issue.findFirst.mockResolvedValueOnce({
        id: "parent-1",
        sprintId: "sprint-1",
        parentIssueId: null,
      });
      prisma.sprint.findFirst.mockResolvedValue({ id: "sprint-2" });

      await create(WorkspaceRole.ADMIN, {
        parentIssueId: "parent-1",
        sprintId: "sprint-2",
      });

      expect(createdData()).toMatchObject({ sprintId: "sprint-2" });
    });

    it("refuses a sub-issue of a sub-issue", async () => {
      prisma.issue.findFirst.mockResolvedValueOnce({
        id: "child-1",
        sprintId: null,
        parentIssueId: "parent-1",
      });

      await expect(
        create(WorkspaceRole.ADMIN, { parentIssueId: "child-1" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.issue.create).not.toHaveBeenCalled();
    });

    it("leaves type and parent alone for a top-level issue", async () => {
      await create(WorkspaceRole.ADMIN, {});

      expect(createdData()).not.toHaveProperty("parentIssueId");
      expect(createdData()).not.toHaveProperty("type");
    });
  });
});

describe("IssueService lane ranks", () => {
  const workspaceId = "ws-1";
  const projectId = "proj-1";
  const owner = accessAs(WorkspaceRole.OWNER, { workspaceId });

  /** Every call on the fake Prisma, in order, so lock-before-read is checkable. */
  let calls: string[];
  let prisma: {
    issue: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    project: { findFirst: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let service: IssueService;
  /** The highest stored rank in the lane, as the DB would return it. */
  let laneMax: string | null;

  beforeEach(() => {
    calls = [];
    laneMax = "a3";
    const track =
      <T>(name: string, value: (args: never) => T) =>
      (args: never) => {
        calls.push(name);
        return Promise.resolve(value(args));
      };
    prisma = {
      issue: {
        findFirst: jest.fn(
          track("findFirst", (args: { orderBy?: unknown }) =>
            args.orderBy
              ? laneMax && { rank: laneMax }
              : {
                  id: "issue-1",
                  status: IssueStatus.TODO,
                  reporterId: "u",
                  assigneeId: null,
                },
          ),
        ),
        findMany: jest.fn(
          track("findMany", () => [
            { rank: "a1" },
            { rank: "a5" },
            { rank: "!!broken" },
          ]),
        ),
        create: jest.fn(track("create", () => ({ id: "issue-new" }))),
        update: jest.fn(track("update", () => ({ id: "issue-1" }))),
      },
      project: {
        findFirst: jest.fn().mockResolvedValue({ id: projectId }),
        update: jest.fn().mockResolvedValue({ issueCounter: 7 }),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => {
        calls.push("begin");
        return cb(prisma);
      }),
      $executeRaw: jest.fn(track("lock", () => 1)),
    };
    service = new IssueService(prisma as unknown as PrismaService);
  });

  const rankWritten = (mock: jest.Mock) =>
    (mock.mock.calls[0] as [{ data: { rank?: string } }])[0].data.rank;

  it("locks the lane before reading its last rank, and appends after it", async () => {
    await service.create(workspaceId, projectId, "u", owner, {
      title: "New",
      status: IssueStatus.TODO,
    });

    expect(calls).toEqual(["begin", "lock", "findFirst", "create"]);
    expect(rankWritten(prisma.issue.create)).toBe("a4");
  });

  it("locks the target lane for a status change sent without a rank", async () => {
    await service.update(workspaceId, projectId, "issue-1", owner, {
      status: IssueStatus.IN_PROGRESS,
    });

    expect(calls).toEqual([
      "findFirst",
      "begin",
      "lock",
      "findFirst",
      "update",
    ]);
    expect(rankWritten(prisma.issue.update)).toBe("a4");
  });

  it("stores a client-computed rank as sent, without locking", async () => {
    await service.update(workspaceId, projectId, "issue-1", owner, {
      status: IssueStatus.IN_PROGRESS,
      rank: "a0V",
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(rankWritten(prisma.issue.update)).toBe("a0V");
  });

  it("appends after the highest valid key when the stored maximum is corrupt", async () => {
    laneMax = "!!broken";

    await service.create(workspaceId, projectId, "u", owner, {
      title: "New",
      status: IssueStatus.TODO,
    });

    // Not "a0", which would collide with the start of the lane.
    expect(rankWritten(prisma.issue.create)).toBe("a6");
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
    project: { findFirst: jest.Mock; update: jest.Mock };
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
      project: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
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

  it("scopes the issue page read (with parent and sub-issues) the same way", async () => {
    await expect(
      service.findDetail(workspaceId, projectId, "issue-B"),
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

    it("refuses a parent issue from another workspace or project", async () => {
      prisma.project.findFirst.mockResolvedValue({ id: projectId });

      await expect(create({ parentIssueId: "issue-B" })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.issue.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "issue-B", workspaceId, projectId },
        }),
      );
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
