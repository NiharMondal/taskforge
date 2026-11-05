import { VALIDATION_PIPE_OPTIONS } from "@/app.setup";
import { HttpExceptionFilter } from "@/lib/http-exception.filter";
import { INestApplication, ValidationPipe } from "@nestjs/common";
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
    };

    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(AUTH_THROTTLE)],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    app = moduleRef.createNestApplication();
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
