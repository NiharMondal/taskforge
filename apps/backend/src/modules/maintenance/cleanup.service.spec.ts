import { PrismaService } from "@/prisma/prisma.service";
import { Logger } from "@nestjs/common";
import { InvitationStatus } from "generated/prisma/enums";
import { CleanupService } from "./cleanup.service";

const DAY_MS = 86_400_000;
const now = new Date("2026-10-30T03:17:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS);

let prisma: {
  pendingRegistration: { deleteMany: jest.Mock };
  passwordReset: { deleteMany: jest.Mock };
  refreshToken: { deleteMany: jest.Mock };
  invitation: { updateMany: jest.Mock };
  stripeEvent: { deleteMany: jest.Mock };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
};
let service: CleanupService;

beforeEach(() => {
  jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  prisma = {
    pendingRegistration: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    passwordReset: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
    invitation: { updateMany: jest.fn().mockResolvedValue({ count: 4 }) },
    stripeEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 5 }) },
    $queryRaw: jest.fn().mockResolvedValue([{ locked: true }]),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
    cb(prisma),
  );
  service = new CleanupService(prisma as unknown as PrismaService);
});

afterEach(() => jest.restoreAllMocks());

describe("CleanupService.run", () => {
  it("reports how many rows each task changed", async () => {
    await expect(service.run(now)).resolves.toEqual({
      pendingRegistrations: 1,
      passwordResets: 2,
      refreshTokens: 3,
      expiredInvitations: 4,
      stripeEvents: 5,
    });
  });

  it("deletes expired sign-up and reset links", async () => {
    await service.run(now);

    expect(prisma.pendingRegistration.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lte: now } },
    });
    expect(prisma.passwordReset.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lte: now } },
    });
  });

  it("deletes refresh tokens expired, revoked or replaced over 30 days ago", async () => {
    await service.run(now);

    const cutoff = daysAgo(30);
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { expiresAt: { lte: cutoff } },
          { revokedAt: { lte: cutoff } },
          { replacedAt: { lte: cutoff } },
        ],
      },
    });
  });

  it("marks only PENDING invitations past their expiry EXPIRED", async () => {
    await service.run(now);

    expect(prisma.invitation.updateMany).toHaveBeenCalledWith({
      where: { status: InvitationStatus.PENDING, expiresAt: { lte: now } },
      data: { status: InvitationStatus.EXPIRED },
    });
  });

  it("deletes Stripe event ids older than 90 days", async () => {
    await service.run(now);

    expect(prisma.stripeEvent.deleteMany).toHaveBeenCalledWith({
      where: { processedAt: { lte: daysAgo(90) } },
    });
  });

  it("keeps going when one task fails, and reports it as null", async () => {
    prisma.refreshToken.deleteMany.mockRejectedValue(new Error("boom"));

    const report = await service.run(now);

    expect(report).toMatchObject({ refreshTokens: null, stripeEvents: 5 });
    expect(prisma.invitation.updateMany).toHaveBeenCalled();
    expect(prisma.stripeEvent.deleteMany).toHaveBeenCalled();
  });

  it("does nothing while another instance holds the lock", async () => {
    prisma.$queryRaw.mockResolvedValue([{ locked: false }]);

    await expect(service.run(now)).resolves.toBeNull();
    expect(prisma.pendingRegistration.deleteMany).not.toHaveBeenCalled();
    expect(prisma.invitation.updateMany).not.toHaveBeenCalled();
  });
});
