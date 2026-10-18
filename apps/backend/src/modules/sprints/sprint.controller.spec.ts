import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { WorkspaceGuard } from "@/common/guards/workspace.guard";
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
import { SprintController } from "./sprint.controller";
import { SprintService } from "./sprint.service";

/** Stands in for JwtAuthGuard + WorkspaceGuard: caller is an admin of ws-1. */
const allowAsWorkspaceAdmin: CanActivate = {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    req.user = { sub: "user-admin", email: "admin@example.com" };
    req.workspaceId = "ws-1";
    req.membershipRole = WorkspaceRole.ADMIN;
    return true;
  },
};

describe("SprintController (HTTP validation)", () => {
  let app: INestApplication;
  const server = () => app.getHttpServer() as App;
  let service: { updateSprint: jest.Mock };

  beforeEach(async () => {
    service = { updateSprint: jest.fn().mockResolvedValue({ id: "s-1" }) };

    const moduleRef = await Test.createTestingModule({
      controllers: [SprintController],
      providers: [{ provide: SprintService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAsWorkspaceAdmin)
      .overrideGuard(WorkspaceGuard)
      .useValue(allowAsWorkspaceAdmin)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(() => app.close());

  describe("PATCH /projects/:projectId/sprints/:sprintId", () => {
    it("accepts a partial update without a name", async () => {
      await request(server())
        .patch("/projects/p-1/sprints/s-1")
        .send({ goal: "Ship the board" })
        .expect(200);

      expect(service.updateSprint).toHaveBeenCalledWith(
        "ws-1",
        "p-1",
        "s-1",
        WorkspaceRole.ADMIN,
        { goal: "Ship the board" },
      );
    });

    it("lets the goal be cleared with null", async () => {
      await request(server())
        .patch("/projects/p-1/sprints/s-1")
        .send({ goal: null })
        .expect(200);

      expect(service.updateSprint).toHaveBeenCalledWith(
        "ws-1",
        "p-1",
        "s-1",
        WorkspaceRole.ADMIN,
        { goal: null },
      );
    });

    it("still rejects malformed fields", async () => {
      await request(server())
        .patch("/projects/p-1/sprints/s-1")
        .send({ startDate: "not-a-date" })
        .expect(400);

      expect(service.updateSprint).not.toHaveBeenCalled();
    });
  });
});
