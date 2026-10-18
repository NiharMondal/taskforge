import { PrismaService } from "@/prisma/prisma.service";
import { MembershipService } from "./membership.service";

describe("MembershipService.findAllByWorkspaceId", () => {
  let prisma: { membership: { findMany: jest.Mock } };
  let service: MembershipService;

  beforeEach(() => {
    prisma = { membership: { findMany: jest.fn().mockResolvedValue([]) } };
    service = new MembershipService(prisma as unknown as PrismaService);
  });

  it("scopes the roster to the caller's workspace", async () => {
    await service.findAllByWorkspaceId("ws-A");

    expect(prisma.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "ws-A" } }),
    );
  });

  it("selects each member's email through Auth, and nothing else from it", async () => {
    await service.findAllByWorkspaceId("ws-A");

    expect(prisma.membership.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws-A" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            auth: { select: { email: true } },
          },
        },
      },
    });
  });
});
