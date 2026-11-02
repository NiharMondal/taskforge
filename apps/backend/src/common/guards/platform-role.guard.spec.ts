import { PrismaService } from "@/prisma/prisma.service";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PlatformRole } from "generated/prisma/enums";
import {
  PlatformRoleGuard,
  platformRoleSatisfies,
} from "./platform-role.guard";

const contextFor = (request: { user?: { sub: string } }) =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe("PlatformRoleGuard", () => {
  let required: PlatformRole | undefined;
  let findUnique: jest.Mock;
  let guard: PlatformRoleGuard;

  const asUser = { user: { sub: "user-1" } };
  const withRole = (platformRole: PlatformRole | null) =>
    findUnique.mockResolvedValue({ platformRole });

  beforeEach(() => {
    required = PlatformRole.SUPPORT;
    findUnique = jest.fn();
    guard = new PlatformRoleGuard(
      { getAllAndOverride: () => required } as unknown as Reflector,
      { user: { findUnique } } as unknown as PrismaService,
    );
  });

  it("reads the caller's role from the database, by the token's subject", async () => {
    withRole(PlatformRole.SUPPORT);

    await expect(guard.canActivate(contextFor(asUser))).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { platformRole: true },
    });
  });

  it("403s a user without a platform role", async () => {
    withRole(null);

    await expect(guard.canActivate(contextFor(asUser))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("403s when the account no longer exists", async () => {
    findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(contextFor(asUser))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("403s an unauthenticated request without querying", async () => {
    await expect(guard.canActivate(contextFor({}))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("lets ADMIN through a SUPPORT route", async () => {
    withRole(PlatformRole.ADMIN);

    await expect(guard.canActivate(contextFor(asUser))).resolves.toBe(true);
  });

  it("keeps SUPPORT out of an ADMIN route", async () => {
    required = PlatformRole.ADMIN;
    withRole(PlatformRole.SUPPORT);

    await expect(guard.canActivate(contextFor(asUser))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("refuses a route that names no role rather than letting it through", async () => {
    required = undefined;
    withRole(PlatformRole.ADMIN);

    await expect(guard.canActivate(contextFor(asUser))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it.each([
    [null, PlatformRole.SUPPORT, false],
    [PlatformRole.SUPPORT, PlatformRole.SUPPORT, true],
    [PlatformRole.SUPPORT, PlatformRole.ADMIN, false],
    [PlatformRole.ADMIN, PlatformRole.SUPPORT, true],
    [PlatformRole.ADMIN, PlatformRole.ADMIN, true],
  ] as const)("platformRoleSatisfies(%s, %s) is %s", (held, needed, ok) => {
    expect(platformRoleSatisfies(held, needed)).toBe(ok);
  });
});
