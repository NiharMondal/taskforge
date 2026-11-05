import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { HttpExceptionFilter } from "@/lib/http-exception.filter";
import { PrismaService } from "@/prisma/prisma.service";
import { INestApplication, Logger } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";
import { HealthController } from "./health.controller";
import { HEALTH_DB_TIMEOUT_MS, HealthService } from "./health.service";

describe("HealthController (HTTP)", () => {
  let app: INestApplication;
  const server = () => app.getHttpServer() as App;
  let prisma: { $queryRaw: jest.Mock };
  let logError: jest.SpyInstance;

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) };
    logError = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prisma },
        // The real global guard, so the test proves the route is public.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it("answers 200 without a token while the database answers", async () => {
    const res = await request(server()).get("/health").expect(200);

    const body = res.body as {
      success: boolean;
      data: { status: string; db: string; uptime: number };
    };
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      status: "ok",
      db: "ok",
      uptime: expect.any(Number) as number,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("answers 503 when the query fails, without the error's detail", async () => {
    prisma.$queryRaw.mockRejectedValue(
      new Error("connect ECONNREFUSED db.internal:5432"),
    );

    const res = await request(server()).get("/health").expect(503);

    expect(res.body).toEqual({
      success: false,
      statusCode: 503,
      message: "Database unavailable",
      status: "error",
      db: "down",
    });
    expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining("ECONNREFUSED"),
    );
  });
});

describe("HealthService", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("fails the check when the database doesn't answer in time", async () => {
    jest.useFakeTimers();
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const prisma = { $queryRaw: jest.fn(() => new Promise(() => undefined)) };
    const service = new HealthService(prisma as unknown as PrismaService);

    const result = service.check();
    jest.advanceTimersByTime(HEALTH_DB_TIMEOUT_MS);

    await expect(result).rejects.toMatchObject({ status: 503 });
  });
});
