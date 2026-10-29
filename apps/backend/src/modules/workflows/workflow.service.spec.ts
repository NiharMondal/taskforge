import { PlanLimitException } from "@/common/plans/plan-limits";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { MAX_WORKFLOW_STATUSES } from "@taskforge/shared";
import { StatusCategory } from "generated/prisma/enums";
import { WorkflowService } from "./workflow.service";

describe("WorkflowService", () => {
  const workspaceId = "ws-1";
  const projectId = "proj-1";
  const me = "user-me";

  const status = (
    id: string,
    category: StatusCategory,
    position: string,
    isDefault = false,
  ) => ({ id, name: id, color: "#6b7280", category, position, isDefault });

  /** The project's statuses as stored; tests change it before acting. */
  let statuses: ReturnType<typeof status>[];
  /** Issues in the status being deleted, in rank order. */
  let issuesInStatus: { id: string }[];
  let plan: "FREE" | "PRO";
  /** Every call on the fake Prisma, in order, so lock-before-read is checkable. */
  let calls: string[];
  let prisma: {
    project: { findFirst: jest.Mock };
    subscription: { findUnique: jest.Mock };
    workflowStatus: {
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
    workflowTransition: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
      createMany: jest.Mock;
    };
    issue: { findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let service: WorkflowService;

  beforeEach(() => {
    statuses = [
      status("backlog", StatusCategory.BACKLOG, "a0", true),
      status("todo", StatusCategory.UNSTARTED, "a1"),
      status("doing", StatusCategory.STARTED, "a2"),
      status("done", StatusCategory.COMPLETED, "a3"),
    ];
    issuesInStatus = [];
    plan = "PRO";
    calls = [];
    const track =
      <T>(name: string, value: (args: never) => T) =>
      (args: never) => {
        calls.push(name);
        return Promise.resolve(value(args));
      };
    prisma = {
      project: { findFirst: jest.fn().mockResolvedValue({ id: projectId }) },
      subscription: {
        findUnique: jest.fn(() =>
          Promise.resolve(
            plan === "PRO" ? { plan: "PRO", status: "ACTIVE" } : null,
          ),
        ),
      },
      workflowStatus: {
        findMany: jest.fn(
          track("statuses", (args: { select: { _count?: unknown } }) =>
            statuses.map((s) =>
              args.select._count ? { ...s, _count: { issues: 2 } } : s,
            ),
          ),
        ),
        create: jest.fn(({ data }: { data: object }) =>
          Promise.resolve({ id: "new", ...data }),
        ),
        update: jest.fn(({ data }: { data: object }) => Promise.resolve(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        delete: jest.fn().mockResolvedValue({}),
      },
      workflowTransition: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      issue: {
        findMany: jest.fn(() => Promise.resolve(issuesInStatus)),
        // The target lane's last rank.
        findFirst: jest.fn().mockResolvedValue({ rank: "a5" }),
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
      $executeRaw: jest.fn(track("lock", () => 1)),
    };
    service = new WorkflowService(prisma as unknown as PrismaService);
  });

  /** The keys the advisory locks were taken on, in order. */
  const locks = () =>
    (prisma.$executeRaw.mock.calls as [TemplateStringsArray, string][]).map(
      ([, key]) => key,
    );
  const nothingWritten = () => {
    expect(prisma.workflowStatus.create).not.toHaveBeenCalled();
    expect(prisma.workflowStatus.update).not.toHaveBeenCalled();
    expect(prisma.workflowStatus.delete).not.toHaveBeenCalled();
    expect(prisma.workflowTransition.createMany).not.toHaveBeenCalled();
    expect(prisma.issue.update).not.toHaveBeenCalled();
  };

  describe("find", () => {
    it("reads the project's statuses in column order, with issue counts", async () => {
      const workflow = await service.find(workspaceId, projectId);

      expect(prisma.workflowStatus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId, projectId },
          orderBy: [{ position: "asc" }, { id: "asc" }],
        }),
      );
      expect(workflow.statuses[0]).toMatchObject({
        id: "backlog",
        issueCount: 2,
      });
      expect(workflow.statuses[0]).not.toHaveProperty("_count");
    });

    it("is a 404 for a project in another workspace", async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.find(workspaceId, "proj-B")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.project.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "proj-B", workspaceId } }),
      );
      expect(prisma.workflowStatus.findMany).not.toHaveBeenCalled();
    });
  });

  describe("on Free", () => {
    beforeEach(() => (plan = "FREE"));

    it.each([
      [
        "adding a status",
        (s: WorkflowService) =>
          s.createStatus(workspaceId, projectId, {
            name: "QA",
            color: "#ef4444",
            category: StatusCategory.STARTED,
          }),
      ],
      [
        "editing a status",
        (s: WorkflowService) =>
          s.updateStatus(workspaceId, projectId, "todo", { name: "Next" }),
      ],
      [
        "deleting a status",
        (s: WorkflowService) =>
          s.deleteStatus(workspaceId, projectId, "doing", me),
      ],
      [
        "changing the moves",
        (s: WorkflowService) =>
          s.replaceTransitions(workspaceId, projectId, { transitions: [] }),
      ],
    ])("refuses %s with a 402", async (_label, act) => {
      await expect(act(service)).rejects.toBeInstanceOf(PlanLimitException);
      nothingWritten();
    });
  });

  it("locks the project's workflow before reading it", async () => {
    await service.updateStatus(workspaceId, projectId, "todo", {
      name: "Next",
    });

    expect(calls.slice(0, 2)).toEqual(["lock", "statuses"]);
    expect(locks()[0]).toBe(`workflow:${projectId}`);
  });

  describe("createStatus", () => {
    const create = (dto: object) =>
      service.createStatus(workspaceId, projectId, {
        name: "QA",
        color: "#ef4444",
        category: StatusCategory.STARTED,
        ...dto,
      });
    const written = () =>
      (
        prisma.workflowStatus.create.mock.calls[0] as [
          { data: { position: string } },
        ]
      )[0].data;

    it("adds the status last when no position is sent", async () => {
      await create({});

      expect(written()).toMatchObject({ workspaceId, projectId });
      expect(written().position > "a3").toBe(true);
    });

    it("stores a free position as sent, and moves a taken one just after its holder", async () => {
      await create({ position: "a1V" });
      expect(written().position).toBe("a1V");

      prisma.workflowStatus.create.mockClear();
      await create({ position: "a1" });
      expect(written().position > "a1" && written().position < "a2").toBe(true);
    });

    it("refuses a name already used in the project, ignoring case", async () => {
      await expect(create({ name: "DOING" })).rejects.toBeInstanceOf(
        ConflictException,
      );
      nothingWritten();
    });

    it(`refuses a status past ${MAX_WORKFLOW_STATUSES}`, async () => {
      statuses = Array.from({ length: MAX_WORKFLOW_STATUSES }, (_, i) =>
        status(`s${i}`, StatusCategory.STARTED, `a${i}`),
      );

      await expect(create({})).rejects.toBeInstanceOf(ConflictException);
      nothingWritten();
    });

    it("refuses a position the index library can't build on", async () => {
      await expect(create({ position: "0" })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe("updateStatus", () => {
    const update = (statusId: string, dto: object) =>
      service.updateStatus(workspaceId, projectId, statusId, dto);

    it("makes a status the default and clears the old one", async () => {
      await update("todo", { isDefault: true });

      expect(prisma.workflowStatus.updateMany).toHaveBeenCalledWith({
        where: { workspaceId, projectId, isDefault: true },
        data: { isDefault: false },
      });
      expect(prisma.workflowStatus.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "todo" } }),
      );
    });

    it("refuses unsetting the default (a project always has one)", async () => {
      await expect(
        update("backlog", { isDefault: false }),
      ).rejects.toBeInstanceOf(BadRequestException);
      nothingWritten();
    });

    it("refuses recategorizing the last completed status", async () => {
      await expect(
        update("done", { category: StatusCategory.STARTED }),
      ).rejects.toBeInstanceOf(ConflictException);
      nothingWritten();
    });

    it("allows recategorizing when another status keeps the category", async () => {
      statuses.push(status("shipped", StatusCategory.COMPLETED, "a4"));

      await update("done", { category: StatusCategory.STARTED });

      expect(prisma.workflowStatus.update).toHaveBeenCalledTimes(1);
    });

    it("refuses another status's name, but lets a status keep its own", async () => {
      await expect(update("todo", { name: "Done" })).rejects.toBeInstanceOf(
        ConflictException,
      );

      await update("todo", { name: "TODO" });
      expect(prisma.workflowStatus.update).toHaveBeenCalledTimes(1);
    });

    it("is a 404 for a status of another project", async () => {
      await expect(update("status-B", { name: "Mine" })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      nothingWritten();
    });
  });

  describe("deleteStatus", () => {
    const remove = (statusId: string, moveTo?: string) =>
      service.deleteStatus(workspaceId, projectId, statusId, me, moveTo);

    it("deletes a status without issues", async () => {
      await remove("doing");

      expect(prisma.workflowStatus.delete).toHaveBeenCalledWith({
        where: { id: "doing" },
      });
    });

    it("refuses deleting the default status", async () => {
      await expect(remove("backlog", "todo")).rejects.toBeInstanceOf(
        ConflictException,
      );
      nothingWritten();
    });

    it("refuses deleting the last unstarted status", async () => {
      await expect(remove("todo")).rejects.toBeInstanceOf(ConflictException);
      nothingWritten();
    });

    it("refuses deleting a status with issues until it knows where they go", async () => {
      issuesInStatus = [{ id: "issue-1" }];

      await expect(remove("doing")).rejects.toBeInstanceOf(ConflictException);
      nothingWritten();
    });

    it("moves the issues, in order, to the end of the target lane, with a history row each", async () => {
      issuesInStatus = [{ id: "issue-1" }, { id: "issue-2" }];

      await remove("doing", "todo");

      // Both lanes are held: the one being emptied, then the target.
      expect(locks()).toEqual([
        `workflow:${projectId}`,
        `issue-lane:${projectId}:doing`,
        `issue-lane:${projectId}:todo`,
      ]);
      const moved = (
        prisma.issue.update.mock.calls as [
          { where: { id: string }; data: { statusId: string; rank: string } },
        ][]
      ).map(([args]) => args);
      expect(moved.map((m) => m.where.id)).toEqual(["issue-1", "issue-2"]);
      expect(moved.every((m) => m.data.statusId === "todo")).toBe(true);
      // After the lane's last card ("a5"), in the order they had.
      expect(moved[0].data.rank > "a5").toBe(true);
      expect(moved[1].data.rank > moved[0].data.rank).toBe(true);

      expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityId: "issue-1",
          userId: me,
          action: "issue.updated",
          metadata: {
            changes: [{ field: "status", from: "doing", to: "todo" }],
          },
        }) as unknown,
      });
      expect(prisma.workflowStatus.delete).toHaveBeenCalledTimes(1);
    });

    it("refuses moving the issues into the status being deleted", async () => {
      issuesInStatus = [{ id: "issue-1" }];

      await expect(remove("doing", "doing")).rejects.toBeInstanceOf(
        BadRequestException,
      );
      nothingWritten();
    });

    it("is a 404 when the target is another project's status", async () => {
      issuesInStatus = [{ id: "issue-1" }];

      await expect(remove("doing", "status-B")).rejects.toBeInstanceOf(
        NotFoundException,
      );
      nothingWritten();
    });
  });

  describe("replaceTransitions", () => {
    const replace = (transitions: [string, string][]) =>
      service.replaceTransitions(workspaceId, projectId, {
        transitions: transitions.map(([fromStatusId, toStatusId]) => ({
          fromStatusId,
          toStatusId,
        })),
      });

    it("replaces every move in the project", async () => {
      await replace([
        ["todo", "doing"],
        ["doing", "done"],
      ]);

      expect(prisma.workflowTransition.deleteMany).toHaveBeenCalledWith({
        where: { projectId },
      });
      expect(prisma.workflowTransition.createMany).toHaveBeenCalledWith({
        data: [
          { fromStatusId: "todo", toStatusId: "doing", projectId },
          { fromStatusId: "doing", toStatusId: "done", projectId },
        ],
      });
    });

    it.each<[string, [string, string][]]>([
      ["another project's status", [["todo", "status-B"]]],
      ["a move to the same status", [["todo", "todo"]]],
      [
        "the same move twice",
        [
          ["todo", "doing"],
          ["todo", "doing"],
        ],
      ],
    ])("refuses %s", async (_label, transitions) => {
      await expect(replace(transitions)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.workflowTransition.deleteMany).not.toHaveBeenCalled();
    });
  });
});
