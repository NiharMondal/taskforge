import { VALIDATION_PIPE_OPTIONS } from "@/app.setup";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { WorkspaceGuard } from "@/common/guards/workspace.guard";
import { accessAs } from "@/common/permissions/test-access";
import { HttpExceptionFilter } from "@/lib/http-exception.filter";
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
import { AssignedIssuesController } from "./assigned-issues.controller";
import { IssueService } from "./issue.service";

/** Stands in for JwtAuthGuard + WorkspaceGuard: caller is a member of ws-1. */
const allowAsMember: CanActivate = {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    req.user = { sub: "user-1", email: "member@example.com" };
    req.workspaceId = "ws-1";
    req.access = accessAs(WorkspaceRole.MEMBER, { userId: "user-1" });
    return true;
  },
};

describe("AssignedIssuesController (HTTP)", () => {
  let app: INestApplication;
  const server = () => app.getHttpServer() as App;
  let service: { findAssigned: jest.Mock };

  beforeEach(async () => {
    service = {
      findAssigned: jest.fn().mockResolvedValue({
        issues: [],
        metaData: { currentPage: 1, totalPages: 0, totalData: 0 },
      }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AssignedIssuesController],
      providers: [{ provide: IssueService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAsMember)
      .overrideGuard(WorkspaceGuard)
      .useValue(allowAsMember)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
    await app.init();
  });

  afterEach(() => app.close());

  it("reads the caller's own issues in the guarded workspace", async () => {
    await request(server()).get("/issues/assigned?limit=10").expect(200);

    expect(service.findAssigned).toHaveBeenCalledWith(
      "ws-1",
      "user-1",
      expect.objectContaining({ page: 1, limit: 10 }),
    );
  });

  it("refuses an assignee in the query: it is always the caller", async () => {
    await request(server())
      .get("/issues/assigned?assigneeId=00000000-0000-0000-0000-000000000000")
      .expect(400);

    expect(service.findAssigned).not.toHaveBeenCalled();
  });
});
