import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { WorkspaceGuard } from "@/common/guards/workspace.guard";
import { HttpExceptionFilter } from "@/lib/http-exception.filter";
import { PrismaService } from "@/prisma/prisma.service";
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";
import { InvitationController } from "./invitation.controller";
import { InvitationService } from "./invitation.service";

/** Stands in for JwtAuthGuard + WorkspaceGuard: caller is an admin of ws-1. */
const allowAsWorkspaceAdmin: CanActivate = {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    req.user = { sub: "user-admin", email: "admin@example.com" };
    req.workspaceId = "ws-1";
    return true;
  },
};

describe("InvitationController (HTTP validation)", () => {
  let app: INestApplication;
  const server = () => app.getHttpServer() as App;
  let service: {
    sendInvitation: jest.Mock;
    validateToken: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      sendInvitation: jest.fn().mockResolvedValue({ id: "inv-1" }),
      validateToken: jest.fn().mockResolvedValue({ email: "bob@example.com" }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [InvitationController],
      providers: [
        { provide: InvitationService, useValue: service },
        { provide: PrismaService, useValue: {} },
      ],
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

  describe("POST /invitations", () => {
    it("rejects an OWNER invitation", async () => {
      await request(server())
        .post("/invitations")
        .send({ email: "bob@example.com", role: "OWNER" })
        .expect(400);

      expect(service.sendInvitation).not.toHaveBeenCalled();
    });

    it.each(["ADMIN", "MEMBER", "VIEWER"])("accepts role %s", async (role) => {
      await request(server())
        .post("/invitations")
        .send({ email: "bob@example.com", role })
        .expect(201);

      expect(service.sendInvitation).toHaveBeenCalledWith(
        "ws-1",
        "user-admin",
        {
          email: "bob@example.com",
          role,
        },
      );
    });

    it("defaults the role when none is sent", async () => {
      await request(server())
        .post("/invitations")
        .send({ email: "bob@example.com" })
        .expect(201);
    });

    it("rejects a role that does not exist", async () => {
      await request(server())
        .post("/invitations")
        .send({ email: "bob@example.com", role: "SUPERUSER" })
        .expect(400);
    });
  });

  describe("GET /invitations/validate", () => {
    it("requires the token query param", async () => {
      await request(server()).get("/invitations/validate").expect(400);

      expect(service.validateToken).not.toHaveBeenCalled();
    });

    it("rejects an empty token", async () => {
      await request(server()).get("/invitations/validate?token=").expect(400);

      expect(service.validateToken).not.toHaveBeenCalled();
    });

    it("passes a provided token through", async () => {
      await request(server())
        .get("/invitations/validate?token=abc123")
        .expect(200);

      expect(service.validateToken).toHaveBeenCalledWith("abc123");
    });
  });
});
