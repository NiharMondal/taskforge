import { VALIDATION_PIPE_OPTIONS } from "@/app.setup";
import { HttpExceptionFilter } from "@/lib/http-exception.filter";
import { PrismaService } from "@/prisma/prisma.service";
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PlatformRole } from "generated/prisma/enums";
import request from "supertest";
import type { App } from "supertest/types";
import { AdminActionsService } from "./admin-actions.service";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

/**
 * The real PlatformRoleGuard, over a fake `user.findUnique` that answers with
 * the caller's role for the test.
 */
describe("AdminController (HTTP)", () => {
  let app: INestApplication;
  const server = () => app.getHttpServer() as App;
  let role: PlatformRole | null;
  let findUnique: jest.Mock;
  let reads: Record<
    "stats" | "findWorkspaces" | "findWorkspace" | "findUsers" | "findUser",
    jest.Mock
  >;
  let actions: Record<
    | "setUserSuspended"
    | "revokeSessions"
    | "deleteUser"
    | "setWorkspaceSuspended"
    | "deleteWorkspace"
    | "auditLog",
    jest.Mock
  >;

  const page = { data: [{ id: "row-1" }], metaData: { totalData: 1 } };
  const reason = { reason: "Chargeback fraud" };

  /** Stands in for the global JwtAuthGuard. */
  const signedIn: CanActivate = {
    canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest<Record<string, unknown>>();
      req.user = { sub: "staff-1", email: "staff@example.com" };
      return true;
    },
  };

  beforeEach(async () => {
    role = PlatformRole.SUPPORT;
    findUnique = jest.fn(() =>
      Promise.resolve({ platformRole: role, suspendedAt: null }),
    );
    reads = {
      stats: jest.fn().mockResolvedValue({ users: { total: 3 } }),
      findWorkspaces: jest.fn().mockResolvedValue(page),
      findWorkspace: jest.fn().mockResolvedValue({ id: "ws-1" }),
      findUsers: jest.fn().mockResolvedValue(page),
      findUser: jest.fn().mockResolvedValue({ id: "user-2" }),
    };
    actions = {
      setUserSuspended: jest.fn().mockResolvedValue(undefined),
      revokeSessions: jest.fn().mockResolvedValue({ revoked: 2 }),
      deleteUser: jest.fn().mockResolvedValue(undefined),
      setWorkspaceSuspended: jest.fn().mockResolvedValue(undefined),
      deleteWorkspace: jest.fn().mockResolvedValue(undefined),
      auditLog: jest.fn().mockResolvedValue(page),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: reads },
        { provide: AdminActionsService, useValue: actions },
        { provide: PrismaService, useValue: { user: { findUnique } } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalGuards(signedIn);
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
    await app.init();
  });

  afterEach(() => app.close());

  const READS = [
    "/admin/stats",
    "/admin/workspaces",
    "/admin/workspaces/ws-1",
    "/admin/users",
    "/admin/users/user-2",
  ];

  /** Every ADMIN-only route, with a valid body. */
  const WRITES = [
    () =>
      request(server())
        .patch("/admin/users/user-2")
        .send({ suspended: true, ...reason }),
    () =>
      request(server())
        .post("/admin/users/user-2/revoke-sessions")
        .send(reason),
    () => request(server()).delete("/admin/users/user-2").send(reason),
    () =>
      request(server())
        .patch("/admin/workspaces/ws-1")
        .send({ suspended: true, ...reason }),
    () => request(server()).delete("/admin/workspaces/ws-1").send(reason),
    () => request(server()).get("/admin/audit-log"),
  ];

  const nothingCalled = () => {
    for (const fn of [...Object.values(reads), ...Object.values(actions)]) {
      expect(fn).not.toHaveBeenCalled();
    }
  };

  describe("without a platform role", () => {
    beforeEach(() => {
      role = null;
    });

    it.each(READS)("403s GET %s and reads nothing", async (route) => {
      const res = await request(server()).get(route).expect(403);

      expect(res.body).toMatchObject({ success: false, statusCode: 403 });
      nothingCalled();
    });

    it("403s every action", async () => {
      for (const send of WRITES) await send().expect(403);
      nothingCalled();
    });
  });

  it.each([PlatformRole.SUPPORT, PlatformRole.ADMIN])(
    "lets %s read every route",
    async (staff) => {
      role = staff;

      for (const route of READS) {
        await request(server()).get(route).expect(200);
      }
      // The role is read again on every request, never cached.
      expect(findUnique).toHaveBeenCalledTimes(READS.length);
    },
  );

  it("refuses SUPPORT every action and the audit log: they only read", async () => {
    role = PlatformRole.SUPPORT;

    for (const send of WRITES) await send().expect(403);
    nothingCalled();
  });

  describe("as ADMIN", () => {
    beforeEach(() => {
      role = PlatformRole.ADMIN;
    });

    it("suspends a user as the caller, with the trimmed reason, and returns the user", async () => {
      const res = await request(server())
        .patch("/admin/users/user-2")
        .send({ suspended: true, reason: "  Chargeback fraud  " })
        .expect(200);

      expect(actions.setUserSuspended).toHaveBeenCalledWith(
        "staff-1",
        "user-2",
        { suspended: true, reason: "Chargeback fraud" },
      );
      expect(res.body).toMatchObject({
        message: "User suspended",
        data: { id: "user-2" },
      });
    });

    it("lifts a workspace's suspension", async () => {
      const res = await request(server())
        .patch("/admin/workspaces/ws-1")
        .send({ suspended: false, ...reason })
        .expect(200);

      expect(actions.setWorkspaceSuspended).toHaveBeenCalledWith(
        "staff-1",
        "ws-1",
        { suspended: false, ...reason },
      );
      expect(res.body).toMatchObject({ data: { id: "ws-1" } });
    });

    it("revokes sessions and says how many", async () => {
      const res = await request(server())
        .post("/admin/users/user-2/revoke-sessions")
        .send(reason)
        .expect(200);

      expect(res.body).toMatchObject({ data: { revoked: 2 } });
    });

    it("deletes a user and a workspace", async () => {
      await request(server())
        .delete("/admin/users/user-2")
        .send(reason)
        .expect(200);
      await request(server())
        .delete("/admin/workspaces/ws-1")
        .send(reason)
        .expect(200);

      expect(actions.deleteUser).toHaveBeenCalledWith(
        "staff-1",
        "user-2",
        reason,
      );
      expect(actions.deleteWorkspace).toHaveBeenCalledWith(
        "staff-1",
        "ws-1",
        reason,
      );
    });

    it("reads the audit log for one target", async () => {
      await request(server())
        .get("/admin/audit-log?targetType=USER&targetId=user-2&page=2")
        .expect(200);

      expect(actions.auditLog).toHaveBeenCalledWith({
        targetType: "USER",
        targetId: "user-2",
        page: 2,
        limit: 20,
      });
    });

    it.each([
      [
        "no reason",
        () => request(server()).delete("/admin/users/user-2").send({}),
      ],
      [
        "a blank reason",
        () =>
          request(server())
            .post("/admin/users/user-2/revoke-sessions")
            .send({ reason: "   " }),
      ],
      [
        "a reason over 500 characters",
        () =>
          request(server())
            .delete("/admin/workspaces/ws-1")
            .send({ reason: "x".repeat(501) }),
      ],
      [
        "no suspended flag",
        () => request(server()).patch("/admin/users/user-2").send(reason),
      ],
      [
        "a suspended flag that isn't a boolean",
        () =>
          request(server())
            .patch("/admin/workspaces/ws-1")
            .send({ suspended: "yes", ...reason }),
      ],
      [
        "a key the DTO doesn't declare",
        () =>
          request(server())
            .patch("/admin/users/user-2")
            .send({ suspended: true, platformRole: "ADMIN", ...reason }),
      ],
      [
        "an unknown audit target type",
        () => request(server()).get("/admin/audit-log?targetType=ISSUE"),
      ],
    ])("400s %s", async (_case, send) => {
      await send().expect(400);
      nothingCalled();
    });
  });

  it("ignores x-workspace-id: the routes aren't scoped to a workspace", async () => {
    await request(server())
      .get("/admin/workspaces/ws-1")
      .set("x-workspace-id", "ws-other")
      .expect(200);

    expect(reads.findWorkspace).toHaveBeenCalledWith("ws-1");
  });

  it("passes a page of workspaces through with its metaData", async () => {
    const res = await request(server())
      .get("/admin/workspaces?search=%20acme%20&plan=PRO&page=2&limit=50")
      .expect(200);

    expect(reads.findWorkspaces).toHaveBeenCalledWith({
      search: "acme",
      plan: "PRO",
      page: 2,
      limit: 50,
    });
    expect(res.body).toMatchObject(page);
  });

  it("treats a blank search as none", async () => {
    await request(server()).get("/admin/users?search=%20%20").expect(200);

    expect(reads.findUsers).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it.each([
    "/admin/workspaces?plan=GOLD",
    "/admin/workspaces?ownerId=user-1",
    "/admin/workspaces?limit=101",
    "/admin/users?plan=PRO",
    "/admin/users?email=a@b.c",
    `/admin/users?search=${"x".repeat(201)}`,
  ])("400s %s: only declared, valid query keys", async (route) => {
    await request(server()).get(route).expect(400);

    expect(reads.findWorkspaces).not.toHaveBeenCalled();
    expect(reads.findUsers).not.toHaveBeenCalled();
  });
});
