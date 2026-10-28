import { PrismaService } from "@/prisma/prisma.service";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { WorkspaceRole } from "generated/prisma/enums";
import { Permission } from "../permissions/permissions";
import { accessAs } from "../permissions/test-access";
import { WorkspaceAccess } from "../permissions/workspace-access";
import { PermissionsGuard } from "./permissions.guard";

type FakeRequest = {
  user?: { sub: string };
  headers: Record<string, string>;
  params: Record<string, string>;
  workspaceId?: string;
  access?: WorkspaceAccess;
};

const contextFor = (request: FakeRequest) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe("PermissionsGuard", () => {
  let required: Permission[] | undefined;
  let findUnique: jest.Mock;
  let guard: PermissionsGuard;

  beforeEach(() => {
    required = undefined;
    findUnique = jest.fn().mockResolvedValue({
      role: WorkspaceRole.MEMBER,
      roleId: null,
      assignedRole: null,
    });
    guard = new PermissionsGuard(
      { getAllAndOverride: () => required } as unknown as Reflector,
      { membership: { findUnique } } as unknown as PrismaService,
    );
  });

  const requestWith = (access?: WorkspaceAccess): FakeRequest => ({
    user: { sub: "user-1" },
    headers: { "x-workspace-id": "ws-1" },
    params: {},
    access,
  });

  it("lets through a route that requires nothing", async () => {
    await expect(guard.canActivate(contextFor(requestWith()))).resolves.toBe(
      true,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("admits a caller holding every required permission", async () => {
    required = ["project:manage", "sprint:manage"];

    await expect(
      guard.canActivate(contextFor(requestWith(accessAs(WorkspaceRole.ADMIN)))),
    ).resolves.toBe(true);
  });

  it("refuses a caller missing any one of them", async () => {
    required = ["issue:status", "issue:delete"];

    await expect(
      guard.canActivate(
        contextFor(requestWith(accessAs(WorkspaceRole.MEMBER))),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("reserves workspace:delete for the OWNER", async () => {
    required = ["workspace:delete"];

    await expect(
      guard.canActivate(contextFor(requestWith(accessAs(WorkspaceRole.ADMIN)))),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      guard.canActivate(contextFor(requestWith(accessAs(WorkspaceRole.OWNER)))),
    ).resolves.toBe(true);
  });

  it("resolves the membership itself when WorkspaceGuard hasn't run yet", async () => {
    required = ["issue:delete"];
    const request = requestWith();

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(request.access?.workspaceId).toBe("ws-1");
  });
});
