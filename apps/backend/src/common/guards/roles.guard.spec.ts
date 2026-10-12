import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { WorkspaceRole } from "generated/prisma/enums";
import { RolesGuard } from "./roles.guard";

const contextFor = (membershipRole?: WorkspaceRole) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ membershipRole }) }),
  }) as unknown as ExecutionContext;

describe("RolesGuard", () => {
  let required: WorkspaceRole[] | undefined;
  let guard: RolesGuard;

  beforeEach(() => {
    required = undefined;
    guard = new RolesGuard({
      getAllAndOverride: () => required,
    } as unknown as Reflector);
  });

  it("lets every role through a route without @Roles", () => {
    for (const role of Object.values(WorkspaceRole)) {
      expect(guard.canActivate(contextFor(role))).toBe(true);
    }
  });

  it("rejects a request WorkspaceGuard has not resolved a role for", () => {
    required = [WorkspaceRole.ADMIN];

    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it.each([WorkspaceRole.ADMIN, WorkspaceRole.OWNER])(
    "lets %s through when it is listed",
    (role) => {
      required = [WorkspaceRole.ADMIN, WorkspaceRole.OWNER];

      expect(guard.canActivate(contextFor(role))).toBe(true);
    },
  );

  it("refuses an OWNER/ADMIN role that is not listed", () => {
    required = [WorkspaceRole.OWNER];

    expect(guard.canActivate(contextFor(WorkspaceRole.ADMIN))).toBe(false);
  });

  // The known gap (see CLAUDE.md): MEMBER/VIEWER can never pass, even when the
  // route lists them, so finer-grained rules must live in services.
  it.each([WorkspaceRole.MEMBER, WorkspaceRole.VIEWER])(
    "rejects %s even when the route lists it",
    (role) => {
      required = [role];

      expect(() => guard.canActivate(contextFor(role))).toThrow(
        ForbiddenException,
      );
    },
  );
});
