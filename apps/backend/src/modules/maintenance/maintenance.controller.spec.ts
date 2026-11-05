import { HttpExceptionFilter } from "@/lib/http-exception.filter";
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";
import { CleanupService } from "./cleanup.service";
import { MaintenanceController } from "./maintenance.controller";

describe("MaintenanceController (HTTP)", () => {
  let app: INestApplication;
  const server = () => app.getHttpServer() as App;
  const secret = "a-long-random-cron-secret";
  let cleanup: { run: jest.Mock };
  let cronSecret: string | undefined;

  beforeEach(async () => {
    cronSecret = secret;
    cleanup = { run: jest.fn().mockResolvedValue({ pendingRegistrations: 1 }) };
    const moduleRef = await Test.createTestingModule({
      controllers: [MaintenanceController],
      providers: [
        { provide: CleanupService, useValue: cleanup },
        { provide: ConfigService, useValue: { get: () => cronSecret } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(() => app.close());

  it("runs the cleanup for the right secret", async () => {
    const res = await request(server())
      .post("/maintenance/cleanup")
      .set("Authorization", `Bearer ${secret}`)
      .expect(200);

    expect(cleanup.run).toHaveBeenCalledTimes(1);
    expect((res.body as { data: unknown }).data).toEqual({
      pendingRegistrations: 1,
    });
  });

  it("refuses a missing or wrong secret with 401, running nothing", async () => {
    await request(server()).post("/maintenance/cleanup").expect(401);
    await request(server())
      .post("/maintenance/cleanup")
      .set("Authorization", `Bearer ${secret}x`)
      .expect(401);
    await request(server())
      .post("/maintenance/cleanup")
      .set("Authorization", secret)
      .expect(401);

    expect(cleanup.run).not.toHaveBeenCalled();
  });

  it("is a 503 while CRON_SECRET isn't set, even with an empty bearer", async () => {
    cronSecret = undefined;

    await request(server())
      .post("/maintenance/cleanup")
      .set("Authorization", "Bearer ")
      .expect(503);
    expect(cleanup.run).not.toHaveBeenCalled();
  });
});
