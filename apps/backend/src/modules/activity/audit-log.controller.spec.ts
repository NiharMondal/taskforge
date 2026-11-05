import { VALIDATION_PIPE_OPTIONS } from "@/app.setup";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { WorkspaceGuard } from "@/common/guards/workspace.guard";
import { accessAs } from "@/common/permissions/test-access";
import { HttpExceptionFilter } from "@/lib/http-exception.filter";
import { PrismaService } from "@/prisma/prisma.service";
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { WorkspaceRole } from "generated/prisma/enums";
import request from "supertest";
import type { App } from "supertest/types";
import { AuditLogController } from "./audit-log.controller";
import { AuditLogService } from "./audit-log.service";

describe("AuditLogController (HTTP)", () => {
  let app: INestApplication;
  const server = () => app.getHttpServer() as App;
  let service: { findAll: jest.Mock };
  /** The caller's built-in role in ws-1, set per test. */
  let role: WorkspaceRole;

  /** Stands in for JwtAuthGuard + WorkspaceGuard. */
  const asMemberOfWs1: CanActivate = {
    canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest<Record<string, unknown>>();
      req.user = { sub: "user-1", email: "u@example.com" };
      req.workspaceId = "ws-1";
      req.access = accessAs(role, { workspaceId: "ws-1", userId: "user-1" });
      return true;
    },
  };

  beforeEach(async () => {
    role = WorkspaceRole.ADMIN;
    service = {
      findAll: jest.fn().mockResolvedValue({
        data: [{ id: "log-1" }],
        metaData: { page: 1, limit: 20, total: 1 },
      }),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuditLogController],
      providers: [
        { provide: AuditLogService, useValue: service },
        // PermissionsGuard's dependency; unused since the fake guard sets access.
        { provide: PrismaService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(asMemberOfWs1)
      .overrideGuard(WorkspaceGuard)
      .useValue(asMemberOfWs1)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
    await app.init();
  });

  afterEach(() => app.close());

  it("returns a page of the caller's workspace for audit:read", async () => {
    const res = await request(server())
      .get("/audit-log?entityType=ROLE&page=2&limit=10")
      .expect(200);

    expect(service.findAll).toHaveBeenCalledWith("ws-1", {
      entityType: "ROLE",
      page: 2,
      limit: 10,
    });
    expect(res.body).toMatchObject({
      data: [{ id: "log-1" }],
      metaData: { total: 1 },
    });
  });

  it.each([WorkspaceRole.MEMBER, WorkspaceRole.VIEWER])(
    "403s a %s, who lacks audit:read",
    async (withoutAudit) => {
      role = withoutAudit;

      await request(server()).get("/audit-log").expect(403);
      expect(service.findAll).not.toHaveBeenCalled();
    },
  );

  it("rejects issue history and unknown entity types", async () => {
    await request(server()).get("/audit-log?entityType=ISSUE").expect(400);
    await request(server()).get("/audit-log?entityType=member").expect(400);
    await request(server()).get("/audit-log?workspaceId=ws-2").expect(400);
    expect(service.findAll).not.toHaveBeenCalled();
  });
});
