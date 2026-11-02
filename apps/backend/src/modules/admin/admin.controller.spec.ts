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
  let service: Record<
    "stats" | "findWorkspaces" | "findWorkspace" | "findUsers" | "findUser",
    jest.Mock
  >;

  const page = { data: [{ id: "row-1" }], metaData: { totalData: 1 } };

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
    findUnique = jest.fn(() => Promise.resolve({ platformRole: role }));
    service = {
      stats: jest.fn().mockResolvedValue({ users: { total: 3 } }),
      findWorkspaces: jest.fn().mockResolvedValue(page),
      findWorkspace: jest.fn().mockResolvedValue({ id: "ws-1" }),
      findUsers: jest.fn().mockResolvedValue(page),
      findUser: jest.fn().mockResolvedValue({ id: "user-2" }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: service },
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

  const ROUTES = [
    "/admin/stats",
    "/admin/workspaces",
    "/admin/workspaces/ws-1",
    "/admin/users",
    "/admin/users/user-2",
  ];

  describe("without a platform role", () => {
    beforeEach(() => {
      role = null;
    });

    it.each(ROUTES)("403s GET %s and reads nothing", async (route) => {
      const res = await request(server()).get(route).expect(403);

      expect(res.body).toMatchObject({ success: false, statusCode: 403 });
      for (const method of Object.values(service)) {
        expect(method).not.toHaveBeenCalled();
      }
    });
  });

  it.each([PlatformRole.SUPPORT, PlatformRole.ADMIN])(
    "lets %s read every route",
    async (staff) => {
      role = staff;

      for (const route of ROUTES) {
        await request(server()).get(route).expect(200);
      }
      // The role is read again on every request, never cached.
      expect(findUnique).toHaveBeenCalledTimes(ROUTES.length);
    },
  );

  it("ignores x-workspace-id: the routes aren't scoped to a workspace", async () => {
    await request(server())
      .get("/admin/workspaces/ws-1")
      .set("x-workspace-id", "ws-other")
      .expect(200);

    expect(service.findWorkspace).toHaveBeenCalledWith("ws-1");
  });

  it("passes a page of workspaces through with its metaData", async () => {
    const res = await request(server())
      .get("/admin/workspaces?search=%20acme%20&plan=PRO&page=2&limit=50")
      .expect(200);

    expect(service.findWorkspaces).toHaveBeenCalledWith({
      search: "acme",
      plan: "PRO",
      page: 2,
      limit: 50,
    });
    expect(res.body).toMatchObject(page);
  });

  it("treats a blank search as none", async () => {
    await request(server()).get("/admin/users?search=%20%20").expect(200);

    expect(service.findUsers).toHaveBeenCalledWith({ page: 1, limit: 20 });
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

    expect(service.findWorkspaces).not.toHaveBeenCalled();
    expect(service.findUsers).not.toHaveBeenCalled();
  });

  it("has no write routes yet", async () => {
    await request(server()).patch("/admin/users/user-2").send({}).expect(404);
    await request(server()).delete("/admin/workspaces/ws-1").expect(404);
    await request(server()).post("/admin/users").send({}).expect(404);
  });
});
