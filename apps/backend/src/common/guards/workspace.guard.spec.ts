import { ALL_PERMISSIONS } from "@/common/permissions/permissions";
import { WorkspaceAccess } from "@/common/permissions/workspace-access";
import { PrismaService } from "@/prisma/prisma.service";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { WorkspaceRole } from "generated/prisma/enums";
import { WorkspaceGuard } from "./workspace.guard";

type FakeRequest = {
  user?: { sub: string };
  headers: Record<string, string | string[] | undefined>;
  params: Record<string, string>;
  workspaceId?: string;
  access?: WorkspaceAccess;
};

const contextFor = (request: FakeRequest) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe("WorkspaceGuard", () => {
  let findUnique: jest.Mock;
  let guard: WorkspaceGuard;

  const requestFor = (
    headerId: string | string[] | undefined,
    paramId?: string,
  ): FakeRequest => ({
    user: { sub: "user-1" },
    headers: headerId === undefined ? {} : { "x-workspace-id": headerId },
    params: paramId === undefined ? {} : { workspaceId: paramId },
  });

  beforeEach(() => {
    findUnique = jest.fn().mockResolvedValue({
      role: WorkspaceRole.OWNER,
      roleId: "role-owner",
      assignedRole: { systemKey: WorkspaceRole.OWNER, permissions: [] },
    });
    guard = new WorkspaceGuard({
      membership: { findUnique },
    } as unknown as PrismaService);
  });

  describe("header and path param disagree", () => {
    it("rejects instead of authorizing one workspace and acting on another", async () => {
      // `DELETE /workspaces/B` sent with `x-workspace-id: A` by a member of A.
      const request = requestFor("workspace-A", "workspace-B");

      await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
        ForbiddenException,
      );
      expect(request.workspaceId).toBeUndefined();
    });

    it("does not even look up membership", async () => {
      await expect(
        guard.canActivate(contextFor(requestFor("workspace-A", "workspace-B"))),
      ).rejects.toThrow();

      expect(findUnique).not.toHaveBeenCalled();
    });
  });

  describe("header and path param agree", () => {
    it("authorizes and exposes that workspace on the request", async () => {
      const request = requestFor("workspace-A", "workspace-A");

      await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);

      expect(findUnique).toHaveBeenCalledWith({
        where: {
          userId_workspaceId: { userId: "user-1", workspaceId: "workspace-A" },
        },
        include: {
          assignedRole: { select: { systemKey: true, permissions: true } },
        },
      });
      expect(request.workspaceId).toBe("workspace-A");
      expect(request.access).toMatchObject({
        workspaceId: "workspace-A",
        userId: "user-1",
        roleId: "role-owner",
        isOwner: true,
      });
    });
  });

  describe("only one source is present", () => {
    it("uses the header when there is no path param", async () => {
      const request = requestFor("workspace-A");

      await guard.canActivate(contextFor(request));

      expect(request.workspaceId).toBe("workspace-A");
    });

    it("uses the first value when the header is repeated", async () => {
      const request = requestFor(["workspace-A", "workspace-B"]);

      await guard.canActivate(contextFor(request));

      expect(request.workspaceId).toBe("workspace-A");
    });

    it("falls back to the path param when there is no header", async () => {
      const request = requestFor(undefined, "workspace-B");

      await guard.canActivate(contextFor(request));

      expect(request.workspaceId).toBe("workspace-B");
    });
  });

  describe("the permissions it attaches", () => {
    const permissionsFor = async (membership: object) => {
      findUnique.mockResolvedValue(membership);
      const request = requestFor("workspace-A");
      await guard.canActivate(contextFor(request));
      return [...(request.access?.permissions ?? [])].sort();
    };

    it("come from the member's Role row", async () => {
      await expect(
        permissionsFor({
          role: WorkspaceRole.MEMBER,
          roleId: "role-qa",
          assignedRole: {
            systemKey: null,
            permissions: ["issue:status", "issue:status:done"],
          },
        }),
      ).resolves.toEqual(["issue:status", "issue:status:done"]);
    });

    it("are everything for the OWNER, whatever is stored", async () => {
      await expect(
        permissionsFor({
          role: WorkspaceRole.OWNER,
          roleId: "role-owner",
          assignedRole: { systemKey: WorkspaceRole.OWNER, permissions: [] },
        }),
      ).resolves.toEqual([...ALL_PERMISSIONS].sort());
    });

    it("fall back to the enum role's defaults for a membership with no Role row", async () => {
      await expect(
        permissionsFor({
          role: WorkspaceRole.MEMBER,
          roleId: null,
          assignedRole: null,
        }),
      ).resolves.toEqual(["issue:create", "issue:edit:own", "issue:status"]);
    });

    it("ignore stored keys that aren't in the catalog", async () => {
      await expect(
        permissionsFor({
          role: WorkspaceRole.MEMBER,
          roleId: "role-x",
          assignedRole: {
            systemKey: null,
            permissions: [
              "issue:status",
              "everything:forever",
              "workspace:delete",
            ],
          },
        }),
      ).resolves.toEqual(["issue:status"]);
    });
  });

  describe("rejections", () => {
    it("rejects when neither a header nor a path param is present", async () => {
      await expect(
        guard.canActivate(contextFor(requestFor(undefined))),
      ).rejects.toThrow("Workspace ID missing");
    });

    it("rejects a user who is not a member", async () => {
      findUnique.mockResolvedValue(null);

      await expect(
        guard.canActivate(contextFor(requestFor("workspace-A"))),
      ).rejects.toThrow("No access to this workspace");
    });

    it("rejects an unauthenticated request", async () => {
      const request = requestFor("workspace-A");
      request.user = undefined;

      await expect(guard.canActivate(contextFor(request))).rejects.toThrow(
        "User not authenticated",
      );
    });
  });
});
