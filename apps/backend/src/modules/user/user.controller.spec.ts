import { HttpExceptionFilter } from "@/lib/http-exception.filter";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { NextFunction, Request, Response } from "express";
import request from "supertest";
import type { App } from "supertest/types";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

describe("UserController (HTTP)", () => {
  const me = "user-1";
  const someoneElse = "user-2";

  let app: INestApplication;
  const server = () => app.getHttpServer() as App;
  let userService: { findOne: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    userService = {
      findOne: jest.fn().mockResolvedValue({ id: me, name: "Me" }),
      update: jest.fn().mockResolvedValue({ id: me, name: "Renamed" }),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: userService }],
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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(() => app.close());

  describe("routes that must not exist", () => {
    it("GET /users does not list every user", async () => {
      await request(server()).get("/users").expect(404);

      expect(userService.findOne).not.toHaveBeenCalled();
    });

    it("DELETE /users/:id does not delete anyone", async () => {
      await request(server()).delete(`/users/${me}`).expect(404);
      await request(server()).delete(`/users/${someoneElse}`).expect(404);
    });
  });

  describe("GET /users/me", () => {
    it("returns the caller, resolved from the token", async () => {
      const res = await request(server()).get("/users/me").expect(200);

      expect(userService.findOne).toHaveBeenCalledWith(me);
      expect((res.body as { data: unknown }).data).toEqual({
        id: me,
        name: "Me",
      });
    });
  });

  describe("GET /users/:id", () => {
    it("returns the caller's own profile", async () => {
      await request(server()).get(`/users/${me}`).expect(200);

      expect(userService.findOne).toHaveBeenCalledWith(me);
    });

    it("refuses another user's profile with 403 and never queries it", async () => {
      await request(server()).get(`/users/${someoneElse}`).expect(403);

      expect(userService.findOne).not.toHaveBeenCalled();
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

    it("strips emailVerified, which is not a column, instead of 500ing", async () => {
      await request(server())
        .patch("/users/me")
        .send({ name: "Renamed", emailVerified: true })
        .expect(200);

      expect(userService.update).toHaveBeenCalledWith(me, { name: "Renamed" });
    });
  });
});
