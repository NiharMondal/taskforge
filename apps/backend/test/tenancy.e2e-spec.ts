import { AppModule } from "@/app.module";
import { configureApp } from "@/app.setup";
import { MailService } from "@/modules/mail/mail.service";
import { PrismaService } from "@/prisma/prisma.service";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma } from "generated/prisma/client";
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

  const carol = {
    name: "Carol",
    email: `carol-${run}@e2e.test`,
    password: "secret123",
  };

  /** Signs up in the sign-up and session tests only. */
  const dave = {
    name: "Dave",
    email: `dave-${run}@e2e.test`,
    password: "secret123",
  };

  let aliceToken: string;
  let bobToken: string;
  let aliceWs: string;
  let bobWs: string;
  let projectId: string;
  let issueId: string;
  /** Alice's comment on `issueId`. */
  let commentId: string;

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

  const mail = { sendMail: jest.fn().mockResolvedValue(undefined) };
  /** Every workspace a sign-up created, for cleanup. */
  const createdWorkspaces: string[] = [];

  /** The token in the last verification link emailed to `email`. */
  const verificationToken = (email: string) => {
    const sent = (mail.sendMail.mock.calls as [{ to: string; text: string }][])
      .map(([m]) => m)
      .filter((m) => m.to === email)
      .pop();
    const token = /verify-email\?token=([0-9a-f]{64})/.exec(sent?.text ?? "");
    if (!token) throw new Error(`No verification link was sent to ${email}`);
    return token[1];
  };

  /** Register, follow the emailed link, and find the new workspace. */
  const signUp = async (user: typeof alice) => {
    await api().post("/api/v1/auth/register").send(user).expect(202);
    const verified = await api()
      .post("/api/v1/auth/verify-email")
      .send({ token: verificationToken(user.email) })
      .expect(200);
    const { accessToken, refreshToken } = data<{
      accessToken: string;
      refreshToken: string;
    }>(verified);
    const workspaces = await api()
      .get("/api/v1/workspaces")
      .set(as(accessToken))
      .expect(200);
    const workspaceId = data<{ id: string }[]>(workspaces)[0].id;
    createdWorkspaces.push(workspaceId);
    return { token: accessToken, refreshToken, workspaceId };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(mail)
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

    const comment = await api()
      .post(`/api/v1/projects/${projectId}/issues/${issueId}/comments`)
      .set(as(aliceToken, aliceWs))
      .send({ content: "<p>Kick-off is Monday</p>" })
      .expect(201);
    commentId = data<{ id: string }>(comment).id;
  });

  afterAll(async () => {
    // Workspaces cascade to projects, issues, memberships and invitations;
    // users cascade to their Auth rows.
    await prisma.workspace.deleteMany({
      where: { id: { in: createdWorkspaces } },
    });
    const emails = [alice.email, bob.email, carol.email, dave.email];
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.pendingRegistration.deleteMany({
      where: { email: { in: emails } },
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

  describe("signing up and sessions", () => {
    it("creates nothing until the emailed link is followed", async () => {
      await api().post("/api/v1/auth/register").send(dave).expect(202);

      await expect(
        prisma.user.count({ where: { email: dave.email } }),
      ).resolves.toBe(0);
      await expect(
        prisma.pendingRegistration.count({ where: { email: dave.email } }),
      ).resolves.toBe(1);
      // Not even the password works before the address is confirmed.
      await api()
        .post("/api/v1/auth/login")
        .send({ email: dave.email, password: dave.password })
        .expect(401);
    });

    it("answers a taken address exactly like a new one", async () => {
      const res = await api()
        .post("/api/v1/auth/register")
        .send({ ...alice, password: "different1" })
        .expect(202);

      expect(data(res)).toEqual({ email: alice.email });
      await expect(
        prisma.pendingRegistration.count({ where: { email: alice.email } }),
      ).resolves.toBe(0);
      // Alice's password is untouched.
      await api()
        .post("/api/v1/auth/login")
        .send({ email: alice.email, password: alice.password })
        .expect(200);
    });

    it("signs in from the link once, then by password", async () => {
      const token = verificationToken(dave.email);
      await api().post("/api/v1/auth/verify-email").send({ token }).expect(200);
      await api().post("/api/v1/auth/verify-email").send({ token }).expect(400);

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: dave.email },
        include: { memberships: true },
      });
      expect(user.emailVerifiedAt).not.toBeNull();
      createdWorkspaces.push(...user.memberships.map((m) => m.workspaceId));

      await api()
        .post("/api/v1/auth/login")
        .send({ email: dave.email, password: dave.password })
        .expect(200);
    });

    it("rotates refresh tokens, and sign-out ends the session", async () => {
      const login = await api()
        .post("/api/v1/auth/login")
        .send({ email: dave.email, password: dave.password })
        .expect(200);
      const first = data<{ refreshToken: string }>(login).refreshToken;

      const refreshed = await api()
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: first })
        .expect(200);
      const second = data<{ accessToken: string; refreshToken: string }>(
        refreshed,
      );
      expect(second.refreshToken).not.toBe(first);
      await api()
        .get("/api/v1/workspaces")
        .set(as(second.accessToken))
        .expect(200);

      await api()
        .post("/api/v1/auth/logout")
        .send({ refreshToken: second.refreshToken })
        .expect(200);
      // The whole family is gone, including the token it was rotated from.
      await api()
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: second.refreshToken })
        .expect(401);
      await api()
        .post("/api/v1/auth/refresh")
        .send({ refreshToken: first })
        .expect(401);
    });

    it("rejects a body key the route doesn't declare", async () => {
      const res = await api()
        .post("/api/v1/projects")
        .set(as(aliceToken, aliceWs))
        .send({ name: "Gemini", key: "GEM" })
        .expect(400);

      expect(res.body).toMatchObject({ success: false, statusCode: 400 });
    });
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

    it("keeps Alice's comments out of Bob's own workspace", async () => {
      const comments = `/api/v1/projects/${projectId}/issues/${issueId}/comments`;

      await api().get(comments).set(as(bobToken, bobWs)).expect(404);
      await api()
        .post(comments)
        .set(as(bobToken, bobWs))
        .send({ content: "<p>Injected</p>" })
        .expect(404);
      await api()
        .patch(`${comments}/${commentId}`)
        .set(as(bobToken, bobWs))
        .send({ content: "<p>Hijacked</p>" })
        .expect(404);
      await api()
        .delete(`${comments}/${commentId}`)
        .set(as(bobToken, bobWs))
        .expect(404);

      await expect(
        prisma.comment.findUniqueOrThrow({ where: { id: commentId } }),
      ).resolves.toMatchObject({ content: "<p>Kick-off is Monday</p>" });
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
        "comment:create",
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

    it("lets Bob comment and edit his own comment, but not touch Alice's", async () => {
      const comments = `/api/v1/projects/${projectId}/issues/${issueId}/comments`;

      const created = await api()
        .post(comments)
        .set(as(bobToken, aliceWs))
        .send({ content: "<p>On it</p>" })
        .expect(201);
      const bobCommentId = data<{ id: string }>(created).id;

      await api()
        .patch(`${comments}/${bobCommentId}`)
        .set(as(bobToken, aliceWs))
        .send({ content: "<p>On it, done by Friday</p>" })
        .expect(200);
      await api()
        .patch(`${comments}/${commentId}`)
        .set(as(bobToken, aliceWs))
        .send({ content: "<p>Hijacked</p>" })
        .expect(403);
      await api()
        .delete(`${comments}/${commentId}`)
        .set(as(bobToken, aliceWs))
        .expect(403);

      const thread = await api()
        .get(comments)
        .set(as(bobToken, aliceWs))
        .expect(200);
      expect(
        data<{ id: string; content: string; user: { name: string } }[]>(
          thread,
        ).map((c) => [c.user.name, c.content]),
      ).toEqual([
        ["Alice", "<p>Kick-off is Monday</p>"],
        ["Bob", "<p>On it, done by Friday</p>"],
      ]);

      // The owner moderates: she may delete Bob's comment.
      await api()
        .delete(`${comments}/${bobCommentId}`)
        .set(as(aliceToken, aliceWs))
        .expect(200);
    });
  });

  describe("labels", () => {
    let bugId: string;
    const issues = () => `/api/v1/projects/${projectId}/issues`;
    type Labelled = { id: string; labels: { id: string; name: string }[] };
    const labelsOf = async (id: string) => {
      const res = await api().get(issues()).set(as(aliceToken, aliceWs));
      return data<Labelled[]>(res).find((i) => i.id === id)?.labels;
    };

    beforeAll(async () => {
      const bug = await api()
        .post("/api/v1/labels")
        .set(as(aliceToken, aliceWs))
        .send({ name: " Bug ", color: "#ef4444" })
        .expect(201);
      bugId = data<{ id: string }>(bug).id;
    });

    it("keeps label names unique in the workspace, ignoring case", async () => {
      await api()
        .post("/api/v1/labels")
        .set(as(aliceToken, aliceWs))
        .send({ name: "BUG", color: "#000000" })
        .expect(409);
    });

    it("lets a MEMBER read labels but not manage them", async () => {
      const res = await api()
        .get("/api/v1/labels")
        .set(as(bobToken, aliceWs))
        .expect(200);
      expect(data<{ name: string }[]>(res).map((l) => l.name)).toEqual(["Bug"]);

      await api()
        .post("/api/v1/labels")
        .set(as(bobToken, aliceWs))
        .send({ name: "Mine", color: "#000000" })
        .expect(403);
      await api()
        .delete(`/api/v1/labels/${bugId}`)
        .set(as(bobToken, aliceWs))
        .expect(403);
    });

    it("lets a MEMBER label their own issue, not someone else's", async () => {
      const created = await api()
        .post(issues())
        .set(as(bobToken, aliceWs))
        .send({ title: "Bob's bug", labelIds: [bugId] })
        .expect(201);

      await expect(labelsOf(data<{ id: string }>(created).id)).resolves.toEqual(
        [expect.objectContaining({ id: bugId, name: "Bug" })],
      );
      await api()
        .patch(`${issues()}/${issueId}`)
        .set(as(bobToken, aliceWs))
        .send({ labelIds: [bugId] })
        .expect(403);
    });

    it("refuses a label from another workspace", async () => {
      // Bob owns his own workspace, so he can make a label there.
      const foreign = await api()
        .post("/api/v1/labels")
        .set(as(bobToken, bobWs))
        .send({ name: "Bob's", color: "#22c55e" })
        .expect(201);

      await api()
        .patch(`${issues()}/${issueId}`)
        .set(as(aliceToken, aliceWs))
        .send({ labelIds: [bugId, data<{ id: string }>(foreign).id] })
        .expect(403);
      await expect(labelsOf(issueId)).resolves.toEqual([]);
      await api()
        .delete(`/api/v1/labels/${data<{ id: string }>(foreign).id}`)
        .set(as(aliceToken, aliceWs))
        .expect(404);
    });

    it("takes a deleted label off every issue", async () => {
      await api()
        .patch(`${issues()}/${issueId}`)
        .set(as(aliceToken, aliceWs))
        .send({ labelIds: [bugId] })
        .expect(200);
      await expect(labelsOf(issueId)).resolves.toHaveLength(1);

      await api()
        .delete(`/api/v1/labels/${bugId}`)
        .set(as(aliceToken, aliceWs))
        .expect(200);
      await expect(labelsOf(issueId)).resolves.toEqual([]);
    });
  });

  it("keeps an issue's history: created, changes, moderated comments", async () => {
    const issues = `/api/v1/projects/${projectId}/issues`;
    const created = await api()
      .post(issues)
      .set(as(aliceToken, aliceWs))
      .send({ title: "Tracked", status: "TODO" })
      .expect(201);
    const trackedId = data<{ id: string }>(created).id;
    const activity = `${issues}/${trackedId}/activity`;

    await api()
      .patch(`${issues}/${trackedId}`)
      .set(as(aliceToken, aliceWs))
      .send({ status: "IN_PROGRESS", priority: "HIGH" })
      .expect(200);
    // A reorder within the lane isn't history.
    await api()
      .patch(`${issues}/${trackedId}`)
      .set(as(aliceToken, aliceWs))
      .send({ status: "IN_PROGRESS", rank: "a1" })
      .expect(200);

    // Bob's comment, removed by Alice as a moderator.
    const comment = await api()
      .post(`${issues}/${trackedId}/comments`)
      .set(as(bobToken, aliceWs))
      .send({ content: "<p>Off-topic</p>" })
      .expect(201);
    await api()
      .delete(
        `${issues}/${trackedId}/comments/${data<{ id: string }>(comment).id}`,
      )
      .set(as(aliceToken, aliceWs))
      .expect(200);

    // Any member reads it; Bob is a MEMBER here.
    const res = await api()
      .get(activity)
      .set(as(bobToken, aliceWs))
      .expect(200);
    type Row = { action: string; user: { name: string }; metadata: unknown };
    expect(
      data<Row[]>(res).map((r) => [r.action, r.user.name, r.metadata]),
    ).toEqual([
      ["issue.created", "Alice", null],
      [
        "issue.updated",
        "Alice",
        {
          changes: [
            { field: "status", from: "TODO", to: "IN_PROGRESS" },
            { field: "priority", from: "MEDIUM", to: "HIGH" },
          ],
        },
      ],
      [
        "comment.deleted",
        "Alice",
        { author: { id: expect.any(String) as unknown, name: "Bob" } },
      ],
    ]);

    // Not from Bob's own workspace.
    await api().get(activity).set(as(bobToken, bobWs)).expect(404);
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

  it("gives cards created at the same moment in one lane distinct ranks (H7)", async () => {
    const lane = "QA_REQUESTED";
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        api()
          .post(`/api/v1/projects/${projectId}/issues`)
          .set(as(aliceToken, aliceWs))
          .send({ title: `Parallel ${i}`, status: lane })
          .expect(201),
      ),
    );

    const ranks = created.map((res) => data<{ rank: string }>(res).rank);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it("keys projects from their name and numbers issues per project, even in parallel", async () => {
    const create = (name: string) =>
      api()
        .post("/api/v1/projects")
        .set(as(aliceToken, aliceWs))
        .send({ name })
        .expect(201);
    const first = data<{ id: string; key: string }>(await create("Key Test"));
    const second = data<{ key: string }>(await create("Kilo Tango"));
    expect([first.key, second.key]).toEqual(["KT", "KT2"]);

    const created = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        api()
          .post(`/api/v1/projects/${first.id}/issues`)
          .set(as(aliceToken, aliceWs))
          .send({ title: `Numbered ${i}`, status: i % 2 ? "TODO" : "BACKLOG" })
          .expect(201),
      ),
    );

    const numbers = created
      .map((res) => data<{ number: number }>(res).number)
      .sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("creates sub-issues one level deep and returns them with the parent", async () => {
    const issues = `/api/v1/projects/${projectId}/issues`;
    const child = data<{ id: string; type: string; parentIssueId: string }>(
      await api()
        .post(issues)
        .set(as(aliceToken, aliceWs))
        .send({ title: "Write launch notes", parentIssueId: issueId })
        .expect(201),
    );
    expect(child).toMatchObject({ type: "SUBTASK", parentIssueId: issueId });

    const parent = data<{ subIssues: { id: string }[] }>(
      await api()
        .get(`${issues}/${issueId}`)
        .set(as(aliceToken, aliceWs))
        .expect(200),
    );
    expect(parent.subIssues.map((s) => s.id)).toEqual([child.id]);

    const childDetail = data<{ parentIssue: { id: string } }>(
      await api()
        .get(`${issues}/${child.id}`)
        .set(as(aliceToken, aliceWs))
        .expect(200),
    );
    expect(childDetail.parentIssue.id).toBe(issueId);

    // No grandchildren.
    await api()
      .post(issues)
      .set(as(aliceToken, aliceWs))
      .send({ title: "Too deep", parentIssueId: child.id })
      .expect(400);

    // A parent must be in the same project.
    const other = data<{ id: string }>(
      await api()
        .post("/api/v1/projects")
        .set(as(aliceToken, aliceWs))
        .send({ name: "Other" })
        .expect(201),
    );
    await api()
      .post(`/api/v1/projects/${other.id}/issues`)
      .set(as(aliceToken, aliceWs))
      .send({ title: "Cross-project", parentIssueId: issueId })
      .expect(403);
  });

  it("commits a Backlog issue to To Do when it joins a sprint, and leaves it alone going back", async () => {
    const issues = `/api/v1/projects/${projectId}/issues`;
    const sprint = data<{ id: string }>(
      await api()
        .post(`/api/v1/projects/${projectId}/sprints`)
        .set(as(aliceToken, aliceWs))
        .send({ name: "Commitment" })
        .expect(201),
    );
    const issue = data<{ id: string; status: string }>(
      await api()
        .post(issues)
        .set(as(aliceToken, aliceWs))
        .send({ title: "Groomed" })
        .expect(201),
    );
    expect(issue.status).toBe("BACKLOG");

    const planned = data<{ status: string; rank: string }>(
      await api()
        .patch(`${issues}/${issue.id}`)
        .set(as(aliceToken, aliceWs))
        .send({ sprintId: sprint.id })
        .expect(200),
    );
    expect(planned.status).toBe("TODO");
    expect(planned.rank).toBeTruthy();

    const unplanned = data<{ status: string; sprintId: string | null }>(
      await api()
        .patch(`${issues}/${issue.id}`)
        .set(as(aliceToken, aliceWs))
        .send({ sprintId: null })
        .expect(200),
    );
    expect(unplanned).toMatchObject({ status: "TODO", sprintId: null });
  });

  it("deletes an issue's comments with the issue", async () => {
    const issue = await api()
      .post(`/api/v1/projects/${projectId}/issues`)
      .set(as(aliceToken, aliceWs))
      .send({ title: "Short-lived" })
      .expect(201);
    const doomedId = data<{ id: string }>(issue).id;
    await api()
      .post(`/api/v1/projects/${projectId}/issues/${doomedId}/comments`)
      .set(as(aliceToken, aliceWs))
      .send({ content: "<p>Soon gone</p>" })
      .expect(201);

    await api()
      .delete(`/api/v1/projects/${projectId}/issues/${doomedId}`)
      .set(as(aliceToken, aliceWs))
      .expect(200);

    await expect(
      prisma.comment.count({ where: { issueId: doomedId } }),
    ).resolves.toBe(0);
  });

  describe("errors keep the envelope", () => {
    it("reports a duplicate from the database as Prisma P2002", async () => {
      // The filter maps P2002 to 409; this checks the driver adapter really
      // reports a unique violation that way.
      const error: unknown = await prisma.user
        .create({ data: { name: "Dup", email: alice.email } })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((error as Prisma.PrismaClientKnownRequestError).code).toBe(
        "P2002",
      );
    });

    it("refuses null for a required field with a 400, not a 500", async () => {
      const res = await api()
        .patch(`/api/v1/projects/${projectId}/issues/${issueId}`)
        .set(as(aliceToken, aliceWs))
        .send({ title: null })
        .expect(400);

      expect(res.body).toMatchObject({ success: false, statusCode: 400 });
    });
  });

  it("accepts an invitation once when two accepts race", async () => {
    const { token: carolToken } = await signUp(carol);
    await api()
      .post("/api/v1/invitations")
      .set(as(aliceToken, aliceWs))
      .send({ email: carol.email, role: "VIEWER" })
      .expect(201);
    const { token } = await prisma.invitation.findFirstOrThrow({
      where: { workspaceId: aliceWs, email: carol.email },
    });

    const accept = () =>
      api()
        .post("/api/v1/invitations/accept")
        .set(as(carolToken))
        .send({ token });
    const results = await Promise.all([accept(), accept()]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses[0]).toBe(201);
    expect([400, 409]).toContain(statuses[1]);
    const failed = results.find((r) => r.status !== 201);
    expect(failed?.body).toMatchObject({ success: false });
    await expect(
      prisma.membership.count({
        where: { workspaceId: aliceWs, user: { email: carol.email } },
      }),
    ).resolves.toBe(1);
  });

  describe("ownership transfer and leaving", () => {
    const transfer = "/api/v1/memberships/transfer-ownership";
    const me = "/api/v1/memberships/me";
    const idOf = async (email: string) =>
      (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
    const roleIn = async (token: string) =>
      data<{ role: string }>(
        await api().get(me).set(as(token, aliceWs)).expect(200),
      ).role;

    it("lets only the owner hand the workspace over, swapping OWNER and ADMIN", async () => {
      const aliceId = await idOf(alice.email);
      const bobId = await idOf(bob.email);

      // Bob isn't the owner, so he can't give it to himself.
      await api()
        .post(transfer)
        .set(as(bobToken, aliceWs))
        .send({ userId: bobId })
        .expect(403);

      await api()
        .post(transfer)
        .set(as(aliceToken, aliceWs))
        .send({ userId: bobId })
        .expect(200);
      await expect(roleIn(bobToken)).resolves.toBe("OWNER");
      await expect(roleIn(aliceToken)).resolves.toBe("ADMIN");
      await expect(
        prisma.membership.count({
          where: { workspaceId: aliceWs, role: "OWNER" },
        }),
      ).resolves.toBe(1);

      // Alice is an ADMIN now: she can't take it back herself.
      await api()
        .post(transfer)
        .set(as(aliceToken, aliceWs))
        .send({ userId: aliceId })
        .expect(403);

      // Bob hands it back, and is left an ADMIN.
      await api()
        .post(transfer)
        .set(as(bobToken, aliceWs))
        .send({ userId: aliceId })
        .expect(200);
      await expect(roleIn(aliceToken)).resolves.toBe("OWNER");
      await expect(roleIn(bobToken)).resolves.toBe("ADMIN");
    });

    it("refuses a transfer to someone outside the workspace", async () => {
      const outsider = await prisma.user.create({
        data: { name: "Outsider", email: `outsider-${run}@e2e.test` },
      });
      try {
        await api()
          .post(transfer)
          .set(as(aliceToken, aliceWs))
          .send({ userId: outsider.id })
          .expect(404);
        // The failed transfer didn't demote Alice.
        await expect(roleIn(aliceToken)).resolves.toBe("OWNER");
      } finally {
        await prisma.user.delete({ where: { id: outsider.id } });
      }
    });

    it("lets a member leave, but not the owner", async () => {
      await api().delete(me).set(as(aliceToken, aliceWs)).expect(403);

      await api().delete(me).set(as(bobToken, aliceWs)).expect(200);
      await api()
        .get("/api/v1/projects")
        .set(as(bobToken, aliceWs))
        .expect(403);
    });
  });
});
