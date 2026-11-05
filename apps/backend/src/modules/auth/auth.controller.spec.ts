import { VALIDATION_PIPE_OPTIONS } from "@/app.setup";
import { HttpExceptionFilter } from "@/lib/http-exception.filter";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { Test } from "@nestjs/testing";
import { ThrottlerModule } from "@nestjs/throttler";
import request from "supertest";
import type { App } from "supertest/types";
import { AUTH_THROTTLE } from "./auth.constants";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController (HTTP)", () => {
  let app: INestApplication;
  const server = () => app.getHttpServer() as App;
  let authService: {
    googleSignIn: jest.Mock;
    signIn: jest.Mock;
    register: jest.Mock;
    verifyEmail: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
    changePassword: jest.Mock;
    forgotPassword: jest.Mock;
    resetPassword: jest.Mock;
  };
  const token = "ab".repeat(32);

  beforeEach(async () => {
    authService = {
      googleSignIn: jest
        .fn()
        .mockResolvedValue({ user: { id: "u1" }, accessToken: "jwt" }),
      signIn: jest.fn().mockResolvedValue({ accessToken: "jwt" }),
      register: jest.fn().mockResolvedValue({ email: "a@example.com" }),
      verifyEmail: jest.fn().mockResolvedValue({ accessToken: "jwt" }),
      refresh: jest.fn().mockResolvedValue({ accessToken: "jwt" }),
      logout: jest.fn().mockResolvedValue(undefined),
      changePassword: jest.fn().mockResolvedValue(undefined),
      forgotPassword: jest.fn().mockResolvedValue(undefined),
      resetPassword: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(AUTH_THROTTLE)],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    app = moduleRef.createNestApplication();
    // Stand-in for the global JwtAuthGuard on the one route that needs it.
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: unknown }).user = {
        sub: "user-1",
        email: "me@example.com",
      };
      next();
    });
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
    await app.init();
  });

  afterEach(() => app.close());

  describe("POST /auth/google validation", () => {
    it("rejects the old forged body of { email, name, googleId }", async () => {
      await request(server())
        .post("/auth/google")
        .send({
          email: "victim@example.com",
          name: "Victim",
          googleId: "anything",
        })
        .expect(400);

      expect(authService.googleSignIn).not.toHaveBeenCalled();
    });

    it("rejects an empty body and an empty token", async () => {
      await request(server()).post("/auth/google").send({}).expect(400);
      await request(server())
        .post("/auth/google")
        .send({ idToken: "" })
        .expect(400);

      expect(authService.googleSignIn).not.toHaveBeenCalled();
    });

    it("rejects extra identity fields next to the idToken", async () => {
      await request(server())
        .post("/auth/google")
        .send({ idToken: "tok", email: "victim@example.com" })
        .expect(400);

      expect(authService.googleSignIn).not.toHaveBeenCalled();
    });
  });

  describe("POST /auth/register", () => {
    it("answers 202: the account is only created from the emailed link", async () => {
      const res = await request(server())
        .post("/auth/register")
        .send({ name: "Al", email: "a@example.com", password: "password1" })
        .expect(202);

      expect((res.body as { data: unknown }).data).toEqual({
        email: "a@example.com",
      });
    });

    it("rejects form-only fields such as confirmPassword", async () => {
      await request(server())
        .post("/auth/register")
        .send({
          name: "Al",
          email: "a@example.com",
          password: "password1",
          confirmPassword: "password1",
        })
        .expect(400);

      expect(authService.register).not.toHaveBeenCalled();
    });
  });

  describe("POST /auth/forgot-password", () => {
    it("answers 202 whatever happened to the address", async () => {
      await request(server())
        .post("/auth/forgot-password")
        .send({ email: "a@example.com" })
        .expect(202);

      expect(authService.forgotPassword).toHaveBeenCalledWith({
        email: "a@example.com",
      });
    });

    it("rejects a missing or malformed email", async () => {
      await request(server())
        .post("/auth/forgot-password")
        .send({})
        .expect(400);
      await request(server())
        .post("/auth/forgot-password")
        .send({ email: "not-an-email" })
        .expect(400);

      expect(authService.forgotPassword).not.toHaveBeenCalled();
    });
  });

  describe("POST /auth/reset-password", () => {
    it("takes the link's token and a new password", async () => {
      await request(server())
        .post("/auth/reset-password")
        .send({ token, password: "brand-new1" })
        .expect(200);

      expect(authService.resetPassword).toHaveBeenCalledWith({
        token,
        password: "brand-new1",
      });
    });

    it("rejects a malformed token, a short password and form-only fields", async () => {
      await request(server())
        .post("/auth/reset-password")
        .send({ token: token.slice(2), password: "brand-new1" })
        .expect(400);
      await request(server())
        .post("/auth/reset-password")
        .send({ token, password: "short" })
        .expect(400);
      await request(server())
        .post("/auth/reset-password")
        .send({ token, password: "brand-new1", confirmPassword: "brand-new1" })
        .expect(400);

      expect(authService.resetPassword).not.toHaveBeenCalled();
    });
  });

  describe("PATCH /auth/password", () => {
    const body = { currentPassword: "old-secret1", newPassword: "new-secret2" };

    it("changes the caller's password, taken from the token", async () => {
      const res = await request(server())
        .patch("/auth/password")
        .send(body)
        .expect(200);

      expect(authService.changePassword).toHaveBeenCalledWith("user-1", body);
      expect((res.body as { data: unknown }).data).toBeNull();
    });

    it("rejects a short new password, a missing current one and form-only fields", async () => {
      await request(server())
        .patch("/auth/password")
        .send({ ...body, newPassword: "short" })
        .expect(400);
      await request(server())
        .patch("/auth/password")
        .send({ newPassword: body.newPassword })
        .expect(400);
      await request(server())
        .patch("/auth/password")
        .send({ ...body, confirmPassword: body.newPassword })
        .expect(400);

      expect(authService.changePassword).not.toHaveBeenCalled();
    });

    it("is throttled like the other password routes", async () => {
      for (let i = 0; i < AUTH_THROTTLE[0].limit; i++) {
        await request(server()).patch("/auth/password").send(body).expect(200);
      }
      await request(server()).patch("/auth/password").send(body).expect(429);
    });
  });

  describe.each([
    ["/auth/verify-email", "token"],
    ["/auth/refresh", "refreshToken"],
    ["/auth/logout", "refreshToken"],
  ])("POST %s", (path, field) => {
    it("takes a 64-character hex token", async () => {
      await request(server())
        .post(path)
        .send({ [field]: token })
        .expect(200);
    });

    it("rejects a missing or malformed token", async () => {
      await request(server()).post(path).send({}).expect(400);
      await request(server())
        .post(path)
        .send({ [field]: "not-hex".padEnd(64, "z") })
        .expect(400);
      await request(server())
        .post(path)
        .send({ [field]: token.slice(2) })
        .expect(400);
    });
  });

  describe("rate limiting", () => {
    const limit = AUTH_THROTTLE[0].limit;

    it.each([
      ["login", "/auth/login", { email: "a@example.com", password: "pw" }],
      [
        "register",
        "/auth/register",
        { name: "Al", email: "a@example.com", password: "password1" },
      ],
      ["google", "/auth/google", { idToken: "tok" }],
      ["verify-email", "/auth/verify-email", { token: "ab".repeat(32) }],
      ["forgot-password", "/auth/forgot-password", { email: "a@example.com" }],
      [
        "reset-password",
        "/auth/reset-password",
        { token: "ab".repeat(32), password: "brand-new1" },
      ],
    ])("throttles %s after the per-window limit", async (_n, path, body) => {
      for (let i = 0; i < limit; i++) {
        const res = await request(server()).post(path).send(body);
        expect(res.status).not.toBe(429);
      }

      await request(server()).post(path).send(body).expect(429);
    });

    // The web app refreshes from its own server for every user, so these
    // can't share one per-client budget (and their tokens can't be guessed).
    it.each(["/auth/refresh", "/auth/logout"])(
      "does not throttle %s",
      async (path) => {
        for (let i = 0; i <= limit + 2; i++) {
          await request(server())
            .post(path)
            .send({ refreshToken: token })
            .expect(200);
        }
      },
    );
  });
});
