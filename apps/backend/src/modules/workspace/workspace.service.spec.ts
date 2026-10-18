import { PrismaService } from "@/prisma/prisma.service";
import { WorkspaceRole } from "generated/prisma/enums";
import { WorkspaceService } from "./workspace.service";

describe("WorkspaceService", () => {
  let prisma: {
    workspace: { create: jest.Mock; update: jest.Mock };
    membership: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: WorkspaceService;

  beforeEach(() => {
    prisma = {
      workspace: {
        create: jest.fn().mockResolvedValue({ id: "ws-1" }),
        update: jest.fn().mockResolvedValue({ id: "ws-1" }),
      },
      membership: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );
    service = new WorkspaceService(prisma as unknown as PrismaService);
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
      expect(prisma.membership.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          workspaceId: "ws-1",
          role: WorkspaceRole.OWNER,
        },
      });
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
});
