import { PlanLimitException } from "@/common/plans/plan-limits";
import { PrismaService } from "@/prisma/prisma.service";
import { BadGatewayException, NotFoundException } from "@nestjs/common";
import { WorkspaceRole } from "generated/prisma/enums";
import { BillingService } from "../billing/billing.service";
import { WorkspaceService } from "./workspace.service";

describe("WorkspaceService", () => {
  let prisma: {
    workspace: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      delete: jest.Mock;
    };
    membership: { create: jest.Mock; findMany: jest.Mock };
    role: { createManyAndReturn: jest.Mock };
    $transaction: jest.Mock;
  };
  let billing: { cancelForDeletion: jest.Mock };
  let service: WorkspaceService;

  beforeEach(() => {
    prisma = {
      workspace: {
        create: jest.fn().mockResolvedValue({ id: "ws-1" }),
        update: jest.fn().mockResolvedValue({ id: "ws-1" }),
        findUnique: jest.fn().mockResolvedValue({ id: "ws-1", name: "Acme" }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        delete: jest.fn().mockResolvedValue({ id: "ws-1" }),
      },
      membership: {
        create: jest.fn().mockResolvedValue({}),
        // The workspaces the caller owns: one Free one (their first).
        findMany: jest
          .fn()
          .mockResolvedValue([{ workspace: { subscription: null } }]),
      },
      role: {
        createManyAndReturn: jest.fn(
          ({ data }: { data: { systemKey: WorkspaceRole }[] }) =>
            Promise.resolve(
              data.map((r) => ({
                id: `role-${r.systemKey}`,
                systemKey: r.systemKey,
              })),
            ),
        ),
      },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );
    billing = { cancelForDeletion: jest.fn().mockResolvedValue(undefined) };
    service = new WorkspaceService(
      prisma as unknown as PrismaService,
      billing as unknown as BillingService,
    );
  });

  describe("create", () => {
    it("persists the description and makes the caller the OWNER", async () => {
      await service.create("user-1", {
        name: "Acme",
        description: "Where the work happens",
      });

      expect(prisma.workspace.create).toHaveBeenCalledWith({
        data: { name: "Acme", description: "Where the work happens" },
      });
      const seeded: unknown = expect.arrayContaining([
        expect.objectContaining({
          workspaceId: "ws-1",
          name: "Owner",
          systemKey: WorkspaceRole.OWNER,
        }),
        expect.objectContaining({
          name: "Member",
          systemKey: WorkspaceRole.MEMBER,
          permissions: [
            "issue:create",
            "issue:edit:own",
            "issue:status",
            "comment:create",
          ],
        }),
      ]);
      expect(prisma.role.createManyAndReturn).toHaveBeenCalledWith({
        data: seeded,
        select: { id: true, systemKey: true },
      });
      expect(prisma.membership.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          workspaceId: "ws-1",
          role: WorkspaceRole.OWNER,
          roleId: "role-OWNER",
        },
      });
    });

    it("402s a third Free workspace the caller would own", async () => {
      prisma.membership.findMany.mockResolvedValue([
        { workspace: { subscription: null } },
        { workspace: { subscription: { plan: "PRO", status: "CANCELED" } } },
      ]);

      const error = await service
        .create("user-1", { name: "Acme" })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(PlanLimitException);
      expect((error as PlanLimitException).getResponse()).toMatchObject({
        code: "PLAN_LIMIT",
        limit: "ownedWorkspaces",
      });
      expect(prisma.workspace.create).not.toHaveBeenCalled();
      expect(prisma.membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1", role: WorkspaceRole.OWNER },
        }),
      );
    });

    it("doesn't count owned workspaces on a paid plan", async () => {
      prisma.membership.findMany.mockResolvedValue([
        { workspace: { subscription: null } },
        { workspace: { subscription: { plan: "PRO", status: "ACTIVE" } } },
        { workspace: { subscription: { plan: "PRO", status: "PAST_DUE" } } },
      ]);

      await service.create("user-1", { name: "Acme" });

      expect(prisma.workspace.create).toHaveBeenCalled();
    });

    it("leaves the description unset when none is sent", async () => {
      await service.create("user-1", { name: "Acme" });

      expect(prisma.workspace.create).toHaveBeenCalledWith({
        data: { name: "Acme", description: undefined },
      });
    });
  });

  describe("update", () => {
    it("persists the description", async () => {
      await service.update("ws-1", { description: "New blurb" });

      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: "ws-1" },
        data: { name: undefined, description: "New blurb" },
      });
    });

    it("can clear the description with an empty string", async () => {
      await service.update("ws-1", { name: "Acme", description: "" });

      expect(prisma.workspace.update).toHaveBeenCalledWith({
        where: { id: "ws-1" },
        data: { name: "Acme", description: "" },
      });
    });
  });

  describe("findOne", () => {
    // Membership is WorkspaceGuard's job; any member may read the row.
    it("returns the workspace without a second membership lookup", async () => {
      await expect(service.findOne("ws-1")).resolves.toEqual({
        id: "ws-1",
        name: "Acme",
      });
      expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: "ws-1" },
      });
    });

    it("404s a workspace that no longer exists", async () => {
      prisma.workspace.findUnique.mockResolvedValue(null);

      await expect(service.findOne("ws-gone")).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe("getUserWorkspaces", () => {
    it("lists each workspace with the plan it is on now", async () => {
      prisma.workspace.findMany.mockResolvedValue([
        { id: "ws-1", subscription: null },
        { id: "ws-2", subscription: { plan: "PRO", status: "TRIALING" } },
        { id: "ws-3", subscription: { plan: "PRO", status: "UNPAID" } },
      ]);

      const { data } = await service.getUserWorkspaces("user-1", {});

      expect(data).toEqual([
        { id: "ws-1", plan: "FREE" },
        { id: "ws-2", plan: "PRO" },
        { id: "ws-3", plan: "FREE" },
      ]);
    });
  });

  describe("delete", () => {
    it("cancels the subscription before deleting", async () => {
      await service.delete("ws-1");

      expect(billing.cancelForDeletion).toHaveBeenCalledWith("ws-1");
      expect(
        billing.cancelForDeletion.mock.invocationCallOrder[0],
      ).toBeLessThan(prisma.workspace.delete.mock.invocationCallOrder[0]);
    });

    it("keeps the workspace when the subscription can't be canceled", async () => {
      billing.cancelForDeletion.mockRejectedValue(new BadGatewayException());

      await expect(service.delete("ws-1")).rejects.toBeInstanceOf(
        BadGatewayException,
      );
      expect(prisma.workspace.delete).not.toHaveBeenCalled();
    });
  });
});
