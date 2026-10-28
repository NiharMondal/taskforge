import { hashToken } from "@/helper";
import { PrismaService } from "@/prisma/prisma.service";
import { UnauthorizedException } from "@nestjs/common";
import { REFRESH_TOKEN_REUSE_GRACE_MS } from "./auth.constants";
import { RefreshTokenService } from "./refresh-token.service";

let prisma: {
  refreshToken: {
    create: jest.Mock;
    findUnique: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };
};
let service: RefreshTokenService;

const stored = (overrides: Record<string, unknown> = {}) => ({
  id: "rt-1",
  userId: "user-1",
  familyId: "family-1",
  tokenHash: hashToken("tok"),
  expiresAt: new Date(Date.now() + 60_000),
  replacedAt: null,
  revokedAt: null,
  ...overrides,
});

/** The `where` of every updateMany that revoked something. */
const revocations = () =>
  (
    prisma.refreshToken.updateMany.mock.calls as [
      { where: Record<string, unknown>; data: Record<string, unknown> },
    ][]
  )
    .filter(([args]) => "revokedAt" in args.data)
    .map(([args]) => args.where);

beforeEach(() => {
  prisma = {
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  service = new RefreshTokenService(prisma as unknown as PrismaService);
});

describe("RefreshTokenService.issue", () => {
  it("stores only the hash of a random 64-hex token", async () => {
    const token = await service.issue("user-1", "family-1");

    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const { data } = (
      prisma.refreshToken.create.mock.calls as [
        { data: { tokenHash: string; userId: string; familyId: string } },
      ][]
    )[0][0];
    expect(data).toMatchObject({ userId: "user-1", familyId: "family-1" });
    expect(data.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(data)).not.toContain(token);
  });

  it("starts a new family when none is given", async () => {
    await service.issue("user-1");
    await service.issue("user-1");

    const families = (
      prisma.refreshToken.create.mock.calls as [
        { data: { familyId: string } },
      ][]
    ).map(([args]) => args.data.familyId);
    expect(families[0]).not.toBe(families[1]);
  });
});

describe("RefreshTokenService.consume", () => {
  it("marks a fresh token replaced and returns its user and family", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(stored());

    await expect(service.consume("tok")).resolves.toEqual({
      userId: "user-1",
      familyId: "family-1",
    });
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken("tok") },
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: "rt-1", replacedAt: null, revokedAt: null },
      data: { replacedAt: expect.any(Date) as Date },
    });
    expect(revocations()).toEqual([]);
  });

  it.each([
    ["unknown", null],
    ["expired", stored({ expiresAt: new Date(Date.now() - 1) })],
    ["revoked", stored({ revokedAt: new Date() })],
  ])("refuses an %s token", async (_name, row) => {
    prisma.refreshToken.findUnique.mockResolvedValue(row);

    await expect(service.consume("tok")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it("lets a token replaced moments ago through (concurrent refreshes)", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(
      stored({ replacedAt: new Date(Date.now() - 1_000) }),
    );

    await expect(service.consume("tok")).resolves.toEqual({
      userId: "user-1",
      familyId: "family-1",
    });
    expect(revocations()).toEqual([]);
  });

  it("revokes the whole family when a replaced token comes back later", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(
      stored({
        replacedAt: new Date(Date.now() - REFRESH_TOKEN_REUSE_GRACE_MS - 1_000),
      }),
    );

    await expect(service.consume("tok")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(revocations()).toEqual([{ familyId: "family-1", revokedAt: null }]);
  });

  it("accepts losing the race to a concurrent refresh", async () => {
    prisma.refreshToken.findUnique
      .mockResolvedValueOnce(stored())
      .mockResolvedValueOnce(stored({ replacedAt: new Date() }));
    prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.consume("tok")).resolves.toMatchObject({
      userId: "user-1",
    });
  });

  it("refuses when the token was revoked in between", async () => {
    prisma.refreshToken.findUnique
      .mockResolvedValueOnce(stored())
      .mockResolvedValueOnce(stored({ revokedAt: new Date() }));
    prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.consume("tok")).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("clears the user's expired tokens", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(stored());

    await service.consume("tok");

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", expiresAt: { lte: expect.any(Date) as Date } },
    });
  });
});

describe("RefreshTokenService.revoke", () => {
  it("revokes the token's family", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({ familyId: "family-1" });

    await service.revoke("tok");

    expect(revocations()).toEqual([{ familyId: "family-1", revokedAt: null }]);
  });

  it("ignores an unknown token", async () => {
    await service.revoke("tok");

    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});

describe("RefreshTokenService.revokeAllForUser", () => {
  it("revokes every live token of the user, through the given client", async () => {
    const tx = { refreshToken: { updateMany: jest.fn() } };

    await service.revokeAllForUser("user-1", tx as never);

    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) as Date },
    });
  });
});
