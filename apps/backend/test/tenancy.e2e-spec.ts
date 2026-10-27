import { AppModule } from "@/app.module";
import { configureApp } from "@/app.setup";
import { MailService } from "@/modules/mail/mail.service";
import { PrismaService } from "@/prisma/prisma.service";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { randomUUID } from "crypto";
import request, { Response } from "supertest";
import { App } from "supertest/types";

/**
 * End-to-end over HTTP and a real Postgres: two people sign up, each gets a
 * workspace, and nothing of one is reachable from the other until an
 * invitation is accepted.
 */
describe("Tenancy (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const run = randomUUID().slice(0, 8);
  const alice = {
    name: "Alice",
    email: `alice-${run}@e2e.test`,
    password: "secret123",
  };
  const bob = {
    name: "Bob",
    email: `bob-${run}@e2e.test`,
    password: "secret123",
  };

  let aliceToken: string;
  let bobToken: string;
  let aliceWs: string;
  let bobWs: string;
  let projectId: string;
  let issueId: string;

  const api = () => request(app.getHttpServer());
  /** The payload inside the `sendResponse()` envelope. */
  const data = <T>(res: Response) => (res.body as { data: T }).data;
  const as = (token: string, workspaceId?: string) => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (workspaceId) headers["x-workspace-id"] = workspaceId;
    return headers;
  };

  const signUp = async (user: typeof alice) => {
    const registered = await api()
      .post("/api/v1/auth/register")
      .send(user)
      .expect(201);
    const loggedIn = await api()
      .post("/api/v1/auth/login")
      .send({ email: user.email, password: user.password })
      .expect(200);
    return {
      token: data<{ accessToken: string }>(loggedIn).accessToken,
      workspaceId: data<{ workspace: { id: string } }>(registered).workspace.id,
    };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({ sendMail: jest.fn().mockResolvedValue(undefined) })
      .compile();

    app = configureApp(
      moduleRef.createNestApplication<INestApplication<App>>(),
    );
    await app.init();
    prisma = app.get(PrismaService);

    ({ token: aliceToken, workspaceId: aliceWs } = await signUp(alice));
    ({ token: bobToken, workspaceId: bobWs } = await signUp(bob));

    const project = await api()
      .post("/api/v1/projects")
      .set(as(aliceToken, aliceWs))
      .send({ name: "Apollo" })
      .expect(201);
    projectId = data<{ id: string }>(project).id;

    const issue = await api()
      .post(`/api/v1/projects/${projectId}/issues`)
      .set(as(aliceToken, aliceWs))
      .send({ title: "Launch", status: "TODO" })
      .expect(201);
    issueId = data<{ id: string }>(issue).id;
  });

  afterAll(async () => {
    // Workspaces cascade to projects, issues, memberships and invitations;
    // users cascade to their Auth rows.
    await prisma.workspace.deleteMany({
      where: { id: { in: [aliceWs, bobWs] } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [alice.email, bob.email] } },
    });
    await app.close();
  });

  it("answers the health check under the API prefix", async () => {
    await api().get("/api/v1").expect(200).expect("Hello from NestJs!");
  });

  it("401s a scoped route without a token", async () => {
    await api()
      .get("/api/v1/projects")
      .set("x-workspace-id", aliceWs)
      .expect(401);
  });

  it("registering creates the user, an EMAIL sign-in and an OWNER membership", async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: alice.email },
      include: { auths: true, memberships: true },
    });

    expect(user.auths).toEqual([
      expect.objectContaining({ provider: "EMAIL", providerId: null }),
    ]);
    expect(user.memberships).toEqual([
      expect.objectContaining({ workspaceId: aliceWs, role: "OWNER" }),
    ]);
  });

  it("registering seeds the four built-in roles and assigns Owner", async () => {
    const roles = await prisma.role.findMany({
      where: { workspaceId: aliceWs },
      orderBy: { name: "asc" },
    });
    expect(roles.map((r) => r.systemKey)).toEqual([
      "ADMIN",
      "MEMBER",
      "OWNER",
      "VIEWER",
    ]);

    const ownerPermissions: unknown = expect.arrayContaining([
      "workspace:delete",
      "role:manage",
    ]);
    const me = await api()
      .get("/api/v1/memberships/me")
      .set(as(aliceToken, aliceWs))
      .expect(200);
    expect(data(me)).toMatchObject({
      role: "OWNER",
      assignedRole: { name: "Owner", systemKey: "OWNER" },
      permissions: ownerPermissions,
    });
  });

  describe("before Bob is invited", () => {
    it("rejects Bob sending Alice's workspace header", async () => {
      await api()
        .get("/api/v1/projects")
        .set(as(bobToken, aliceWs))
        .expect(403);
    });

    it("does not show Alice's project in Bob's own workspace", async () => {
      const res = await api()
        .get("/api/v1/projects")
        .set(as(bobToken, bobWs))
        .expect(200);

      expect(data<unknown[]>(res)).toEqual([]);
      await api()
        .get(`/api/v1/projects/${projectId}/issues/${issueId}`)
        .set(as(bobToken, bobWs))
        .expect(404);
    });

    it("rejects a header that disagrees with the path's workspace", async () => {
      // Bob owns bobWs, so this would delete his own workspace if the guard
      // trusted the header alone.
      await api()
        .delete(`/api/v1/workspaces/${aliceWs}`)
        .set(as(bobToken, bobWs))
        .expect(403);

      await expect(
        prisma.workspace.findUnique({ where: { id: aliceWs } }),
      ).resolves.not.toBeNull();
    });
  });

  describe("after Bob accepts an invitation as MEMBER", () => {
    beforeAll(async () => {
      await api()
        .post("/api/v1/invitations")
        .set(as(aliceToken, aliceWs))
        .send({ email: bob.email.toUpperCase(), role: "MEMBER" })
        .expect(201);

      // The token is only ever emailed; read it where the mail would carry it.
      const { token } = await prisma.invitation.findFirstOrThrow({
        where: { workspaceId: aliceWs, email: bob.email },
      });

      await api()
        .post("/api/v1/invitations/accept")
        .set(as(bobToken))
        .send({ token })
        .expect(201);
    });

    it("lets Bob read Alice's workspace", async () => {
      const res = await api()
        .get("/api/v1/projects")
        .set(as(bobToken, aliceWs))
        .expect(200);

      expect(data<{ id: string }[]>(res).map((p) => p.id)).toEqual([projectId]);
    });

    it("lets Bob move an issue but not rename it", async () => {
      const issueUrl = `/api/v1/projects/${projectId}/issues/${issueId}`;

      await api()
        .patch(issueUrl)
        .set(as(bobToken, aliceWs))
        .send({ status: "IN_PROGRESS" })
        .expect(200);
      await api()
        .patch(issueUrl)
        .set(as(bobToken, aliceWs))
        .send({ title: "Hijacked" })
        .expect(403);
    });

    it("still keeps Bob out of OWNER/ADMIN actions", async () => {
      await api()
        .post("/api/v1/projects")
        .set(as(bobToken, aliceWs))
        .send({ name: "Not allowed" })
        .expect(403);
      await api()
        .delete(`/api/v1/projects/${projectId}/issues/${issueId}`)
        .set(as(bobToken, aliceWs))
        .expect(403);
      await api()
        .get("/api/v1/invitations")
        .set(as(bobToken, aliceWs))
        .expect(403);
    });

    it("gives Bob the workspace's Member role", async () => {
      const me = await api()
        .get("/api/v1/memberships/me")
        .set(as(bobToken, aliceWs))
        .expect(200);

      expect(data(me)).toMatchObject({
        role: "MEMBER",
        assignedRole: { name: "Member", systemKey: "MEMBER" },
      });
      expect(data<{ permissions: string[] }>(me).permissions.sort()).toEqual([
        "issue:create",
        "issue:edit:own",
        "issue:status",
      ]);
    });

    it("does not let Bob rewrite the description of Alice's issue (H3)", async () => {
      await api()
        .patch(`/api/v1/projects/${projectId}/issues/${issueId}`)
        .set(as(bobToken, aliceWs))
        .send({ description: "Rewritten" })
        .expect(403);
    });

    it("lets Bob create an issue and edit it, but not mark it DONE", async () => {
      const created = await api()
        .post(`/api/v1/projects/${projectId}/issues`)
        .set(as(bobToken, aliceWs))
        .send({ title: "Bob's task", status: "TODO" })
        .expect(201);
      const url = `/api/v1/projects/${projectId}/issues/${data<{ id: string }>(created).id}`;

      await api()
        .patch(url)
        .set(as(bobToken, aliceWs))
        .send({ title: "Bob's renamed task", description: "Details" })
        .expect(200);
      await api()
        .patch(url)
        .set(as(bobToken, aliceWs))
        .send({ status: "DONE" })
        .expect(403);
    });
  });

  it("appends a new card after the lane's last card in byte order (H6)", async () => {
    // A card dragged above the first one gets a key like "Zz" (uppercase sorts
    // before "a0" in byte order). A locale collation sorts "Zz" *after* "a0",
    // so the server took "Zz" for the last card and handed the new one "a0"
    // again — a duplicate the board can't place anything between.
    const lane = "IN_REVIEW";
    const create = (title: string) =>
      api()
        .post(`/api/v1/projects/${projectId}/issues`)
        .set(as(aliceToken, aliceWs))
        .send({ title, status: lane })
        .expect(201);

    const first = data<{ id: string }>(await create("Upper")).id;
    const second = data<{ id: string }>(await create("Lower")).id;
    await prisma.issue.update({ where: { id: first }, data: { rank: "Zz" } });
    await prisma.issue.update({ where: { id: second }, data: { rank: "a0" } });

    const appended = data<{ rank: string }>(await create("Appended"));

    expect(appended.rank > "a0").toBe(true);
  });
});
