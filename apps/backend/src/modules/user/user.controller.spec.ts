import { VALIDATION_PIPE_OPTIONS } from "@/app.setup";
import { HttpExceptionFilter } from "@/lib/http-exception.filter";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import { NextFunction, Request, Response } from "express";
import request from "supertest";
import type { App } from "supertest/types";
import { AUTH_THROTTLE } from "../auth/auth.constants";
import { AccountService } from "./account.service";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

describe("UserController (HTTP)", () => {
  const me = "user-1";
  const someoneElse = "user-2";

  let app: INestApplication;
  const server = () => app.getHttpServer() as App;
  let userService: { findProfile: jest.Mock; update: jest.Mock };
  let accountService: { deleteAccount: jest.Mock; exportData: jest.Mock };

  beforeEach(async () => {
    userService = {
      findProfile: jest.fn().mockResolvedValue({ id: me, name: "Me" }),
      update: jest.fn().mockResolvedValue({ id: me, name: "Renamed" }),
    };
    accountService = {
      deleteAccount: jest.fn().mockResolvedValue(undefined),
      exportData: jest.fn().mockResolvedValue({ profile: { id: me } }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(AUTH_THROTTLE)],
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: userService },
        { provide: AccountService, useValue: accountService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Stand-in for the global JwtAuthGuard: authenticate every request as `me`.
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: unknown }).user = {
        sub: me,
        email: "me@example.com",
      };
      next();
    });
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
    await app.init();
  });

  afterEach(() => app.close());

  describe("routes that must not exist", () => {
    it("GET /users does not list every user", async () => {
      await request(server()).get("/users").expect(404);

      expect(userService.findProfile).not.toHaveBeenCalled();
    });

    it("DELETE /users/:id does not delete anyone, even the caller by id", async () => {
      await request(server()).delete(`/users/${me}`).expect(404);
      await request(server()).delete(`/users/${someoneElse}`).expect(404);

      expect(accountService.deleteAccount).not.toHaveBeenCalled();
    });
  });

  describe("GET /users/me", () => {
    it("returns the caller, resolved from the token", async () => {
      const res = await request(server()).get("/users/me").expect(200);

      expect(userService.findProfile).toHaveBeenCalledWith(me);
      expect((res.body as { data: unknown }).data).toEqual({
        id: me,
        name: "Me",
      });
    });
  });

  describe("GET /users/:id", () => {
    it("returns the caller's own profile", async () => {
      await request(server()).get(`/users/${me}`).expect(200);

      expect(userService.findProfile).toHaveBeenCalledWith(me);
    });

    it("refuses another user's profile with 403 and never queries it", async () => {
      await request(server()).get(`/users/${someoneElse}`).expect(403);

      expect(userService.findProfile).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /users/:id", () => {
    it("updates the caller's own profile", async () => {
      await request(server())
        .patch(`/users/${me}`)
        .send({ name: "Renamed" })
        .expect(200);

      expect(userService.update).toHaveBeenCalledWith(me, { name: "Renamed" });
    });

    it("refuses to update another user with 403 and writes nothing", async () => {
      await request(server())
        .patch(`/users/${someoneElse}`)
        .send({ name: "Hacked" })
        .expect(403);

      expect(userService.update).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /users/me", () => {
    it("updates the caller, never an id taken from the client", async () => {
      await request(server())
        .patch("/users/me")
        .send({ name: "Renamed" })
        .expect(200);

      expect(userService.update).toHaveBeenCalledWith(me, { name: "Renamed" });
    });

    it("rejects fields it doesn't accept, such as emailVerified, instead of 500ing", async () => {
      await request(server())
        .patch("/users/me")
        .send({ name: "Renamed", emailVerified: true })
        .expect(400);

      expect(userService.update).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /users/me", () => {
    it("deletes the caller, resolved from the token", async () => {
      await request(server())
        .delete("/users/me")
        .send({ password: "secret-password" })
        .expect(200);

      expect(accountService.deleteAccount).toHaveBeenCalledWith(me, {
        password: "secret-password",
      });
    });

    it("rejects a body key the DTO doesn't declare, such as userId", async () => {
      await request(server())
        .delete("/users/me")
        .send({ password: "secret-password", userId: someoneElse })
        .expect(400);

      expect(accountService.deleteAccount).not.toHaveBeenCalled();
    });

    it("throttles attempts per user", async () => {
      for (let i = 0; i < 5; i++) {
        await request(server())
          .delete("/users/me")
          .send({ password: "guess" })
          .expect(200);
      }
      await request(server())
        .delete("/users/me")
        .send({ password: "guess" })
        .expect(429);
    });
  });

  describe("GET /users/me/export", () => {
    it("exports the caller's data", async () => {
      const res = await request(server()).get("/users/me/export").expect(200);

      expect(accountService.exportData).toHaveBeenCalledWith(me);
      expect((res.body as { data: unknown }).data).toEqual({
        profile: { id: me },
      });
    });

    it("is not mistaken for /users/:id", async () => {
      await request(server()).get("/users/me/export").expect(200);

      expect(userService.findProfile).not.toHaveBeenCalled();
    });

    it("throttles downloads per user", async () => {
      for (let i = 0; i < 5; i++) {
        await request(server()).get("/users/me/export").expect(200);
      }
      await request(server()).get("/users/me/export").expect(429);
    });
  });
});
