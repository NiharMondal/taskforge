import { PlatformRole } from "generated/prisma/enums";
import type { PrismaClient } from "generated/prisma/client";
import { parsePlatformRoleArg, setPlatformRole } from "./set-platform-role";

describe("set-platform-role", () => {
  describe("parsePlatformRoleArg", () => {
    it.each([
      ["ADMIN", PlatformRole.ADMIN],
      ["support", PlatformRole.SUPPORT],
      [" Admin ", PlatformRole.ADMIN],
      ["none", null],
      ["NONE", null],
    ])("reads %j", (arg, role) => {
      expect(parsePlatformRoleArg(arg)).toBe(role);
    });

    it.each(["OWNER", "", "admins", undefined])("refuses %j", (arg) => {
      expect(() => parsePlatformRoleArg(arg)).toThrow(/Expected one of/);
    });
  });

  describe("setPlatformRole", () => {
    let tx: {
      user: { findFirst: jest.Mock; update: jest.Mock };
      platformAuditLog: { create: jest.Mock };
    };
    let prisma: Pick<PrismaClient, "$transaction">;

    const ann = {
      id: "u-1",
      email: "ann@example.com",
      name: "Ann",
    };

    beforeEach(() => {
      tx = {
        user: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ ...ann, platformRole: null }),
          update: jest.fn().mockResolvedValue(undefined),
        },
        platformAuditLog: { create: jest.fn().mockResolvedValue(undefined) },
      };
      prisma = {
        $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
      } as unknown as Pick<PrismaClient, "$transaction">;
    });

    it("grants a role and records it with no actor, in the same transaction", async () => {
      const result = await setPlatformRole(
        prisma,
        " Ann@Example.com ",
        PlatformRole.ADMIN,
      );

      expect(tx.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: { equals: "ann@example.com", mode: "insensitive" } },
        }),
      );
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: "u-1" },
        data: { platformRole: PlatformRole.ADMIN },
      });
      expect(tx.platformAuditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: null,
          action: "platform_role.changed",
          targetType: "USER",
          targetId: "u-1",
          metadata: { email: ann.email, from: null, to: PlatformRole.ADMIN },
        },
      });
      expect(result).toEqual({
        user: ann,
        from: null,
        to: PlatformRole.ADMIN,
        changed: true,
      });
    });

    it("clears a role with null", async () => {
      tx.user.findFirst.mockResolvedValue({
        ...ann,
        platformRole: PlatformRole.SUPPORT,
      });

      const result = await setPlatformRole(prisma, ann.email, null);

      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: "u-1" },
        data: { platformRole: null },
      });
      expect(tx.platformAuditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: { email: ann.email, from: PlatformRole.SUPPORT, to: null },
        }) as unknown,
      });
      expect(result.changed).toBe(true);
    });

    it("writes nothing when the user already has the role", async () => {
      tx.user.findFirst.mockResolvedValue({
        ...ann,
        platformRole: PlatformRole.SUPPORT,
      });

      const result = await setPlatformRole(
        prisma,
        ann.email,
        PlatformRole.SUPPORT,
      );

      expect(result.changed).toBe(false);
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.platformAuditLog.create).not.toHaveBeenCalled();
    });

    it("throws for an unknown email and writes nothing", async () => {
      tx.user.findFirst.mockResolvedValue(null);

      await expect(
        setPlatformRole(prisma, "nobody@example.com", PlatformRole.ADMIN),
      ).rejects.toThrow("No account has the email nobody@example.com");
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.platformAuditLog.create).not.toHaveBeenCalled();
    });
  });
});
