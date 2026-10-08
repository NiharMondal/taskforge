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
  };

  beforeEach(async () => {
    authService = {
      googleSignIn: jest
        .fn()
        .mockResolvedValue({ user: { id: "u1" }, accessToken: "jwt" }),
      signIn: jest.fn().mockResolvedValue({ accessToken: "jwt" }),
      register: jest.fn().mockResolvedValue({ user: { id: "u1" } }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(AUTH_THROTTLE)],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
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

    it("hands the service only the idToken, dropping any extra identity fields", async () => {
      await request(server())
        .post("/auth/google")
        .send({ idToken: "tok", email: "victim@example.com" })
        .expect(200);

      expect(authService.googleSignIn).toHaveBeenCalledWith({ idToken: "tok" });
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
    ])("throttles %s after the per-window limit", async (_n, path, body) => {
      for (let i = 0; i < limit; i++) {
        const res = await request(server()).post(path).send(body);
        expect(res.status).not.toBe(429);
      }

      await request(server()).post(path).send(body).expect(429);
    });
  });
});
