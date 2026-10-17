import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InvitationStatus, WorkspaceRole } from "generated/prisma/enums";
import { MailService } from "../mail/mail.service";
import { InvitationService } from "./invitation.service";

const DAY = 24 * 60 * 60 * 1000;

/** The first argument of a mock's first call, typed (jest.Mock is `any`-typed). */
const firstCallArg = <T>(mock: jest.Mock): T =>
  (mock.mock.calls as unknown[][])[0][0] as T;

describe("InvitationService", () => {
  const workspaceId = "ws-1";
  const actorUserId = "user-admin";

  // Two different ids for the same person: Auth.id is NOT User.id. Mixing them
  // up is exactly the bug these tests guard against.
  const invitee = { authId: "auth-77", userId: "user-77" };

  let prisma: {
    membership: { findUnique: jest.Mock; create: jest.Mock };
    auth: { findFirst: jest.Mock; findUnique: jest.Mock };
    invitation: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
    };
    workspace: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let mail: { sendMail: jest.Mock };
  let service: InvitationService;

  beforeEach(() => {
    prisma = {
      membership: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: "m-1" }),
      },
      auth: { findFirst: jest.fn(), findUnique: jest.fn() },
      invitation: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({ id: "inv-1" }),
        update: jest.fn().mockResolvedValue({}),
      },
      workspace: {
        findUnique: jest.fn().mockResolvedValue({ name: "Acme" }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ name: "Alice" }) },
      $transaction: jest.fn(),
    };
    // The actor is an ADMIN unless a test says otherwise; everyone else is not
    // a member by default.
    prisma.membership.findUnique.mockImplementation(
      ({ where }: { where: { userId_workspaceId: { userId: string } } }) =>
        Promise.resolve(
          where.userId_workspaceId.userId === actorUserId
            ? { role: WorkspaceRole.ADMIN }
            : null,
        ),
    );
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );

    mail = { sendMail: jest.fn().mockResolvedValue({}) };
    service = new InvitationService(
      prisma as unknown as PrismaService,
      mail as unknown as MailService,
      { get: () => "http://localhost:3000" } as unknown as ConfigService,
    );
  });

  describe("sendInvitation", () => {
    const send = (dto: { email: string; role?: WorkspaceRole }) =>
      service.sendInvitation(workspaceId, actorUserId, dto);

    it("checks membership by User.id (Auth.userId), not Auth.id", async () => {
      prisma.auth.findFirst.mockResolvedValue({
        id: invitee.authId,
        userId: invitee.userId,
        email: "bob@example.com",
      });

      await send({ email: "bob@example.com" });

      expect(prisma.membership.findUnique).toHaveBeenCalledWith({
        where: {
          userId_workspaceId: { userId: invitee.userId, workspaceId },
        },
      });
      expect(prisma.membership.findUnique).not.toHaveBeenCalledWith({
        where: {
          userId_workspaceId: { userId: invitee.authId, workspaceId },
        },
      });
    });

    it("rejects an email that already belongs to a workspace member", async () => {
      prisma.auth.findFirst.mockResolvedValue({
        id: invitee.authId,
        userId: invitee.userId,
        email: "bob@example.com",
      });
      prisma.membership.findUnique.mockImplementation(
        ({ where }: { where: { userId_workspaceId: { userId: string } } }) =>
          Promise.resolve(
            where.userId_workspaceId.userId === actorUserId
              ? { role: WorkspaceRole.ADMIN }
              : where.userId_workspaceId.userId === invitee.userId
                ? { role: WorkspaceRole.MEMBER }
                : null,
          ),
      );

      await expect(send({ email: "bob@example.com" })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.invitation.upsert).not.toHaveBeenCalled();
    });

    it("rejects an actor who is not an OWNER or ADMIN", async () => {
      prisma.membership.findUnique.mockResolvedValue({
        role: WorkspaceRole.MEMBER,
      });

      await expect(send({ email: "bob@example.com" })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it("stores and emails the lowercase address", async () => {
      await send({ email: "  Bob@Example.COM " });

      const create: unknown = expect.objectContaining({
        email: "bob@example.com",
      });
      expect(prisma.invitation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create }),
      );
      expect(mail.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "bob@example.com" }),
      );
    });

    it("looks up existing accounts and invitations case-insensitively", async () => {
      await send({ email: "Bob@Example.com" });

      expect(prisma.auth.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: "bob@example.com", mode: "insensitive" } },
      });
      expect(prisma.invitation.findFirst).toHaveBeenCalledWith({
        where: {
          workspaceId,
          email: { equals: "bob@example.com", mode: "insensitive" },
        },
      });
    });

    it("updates a legacy mixed-case invitation in place instead of duplicating it", async () => {
      prisma.invitation.findFirst.mockResolvedValue({
        id: "inv-old",
        email: "Bob@Example.com",
        status: InvitationStatus.REVOKED,
        expiresAt: new Date(Date.now() + DAY),
      });

      await send({ email: "bob@example.com" });

      const update: unknown = expect.objectContaining({
        email: "bob@example.com",
      });
      expect(prisma.invitation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            email_workspaceId: { email: "Bob@Example.com", workspaceId },
          },
          update,
        }),
      );
    });

    describe("an existing PENDING invitation", () => {
      it("blocks a re-invite while it is still valid", async () => {
        prisma.invitation.findFirst.mockResolvedValue({
          id: "inv-old",
          email: "bob@example.com",
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + DAY),
        });

        await expect(send({ email: "bob@example.com" })).rejects.toBeInstanceOf(
          ConflictException,
        );
        expect(prisma.invitation.upsert).not.toHaveBeenCalled();
      });

      it("does not block a re-invite once it has expired", async () => {
        prisma.invitation.findFirst.mockResolvedValue({
          id: "inv-old",
          email: "bob@example.com",
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() - DAY),
        });

        await expect(send({ email: "bob@example.com" })).resolves.toBeDefined();

        const update: unknown = expect.objectContaining({
          status: InvitationStatus.PENDING,
        });
        expect(prisma.invitation.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ update }),
        );
      });
    });

    it("never returns the token to the caller, but still emails it", async () => {
      await send({ email: "bob@example.com" });

      const { select } = firstCallArg<{
        select: Record<string, boolean>;
      }>(prisma.invitation.upsert);
      expect(select).toBeDefined();
      expect(select.token).toBeUndefined();

      const { create } = firstCallArg<{
        create: { token: string };
      }>(prisma.invitation.upsert);
      expect(create.token).toMatch(/^[0-9a-f]{64}$/);
      const mailed = firstCallArg<{ text: string }>(mail.sendMail);
      expect(mailed.text).toContain(create.token);
    });

    it("HTML-escapes the inviter and workspace names in the email body", async () => {
      prisma.user.findUnique.mockResolvedValue({
        name: '"><script>alert(1)</script>',
      });
      prisma.workspace.findUnique.mockResolvedValue({
        name: "<img src=x onerror=alert(1)>",
      });

      await send({ email: "bob@example.com" });

      const mailed = firstCallArg<{
        html: string;
        text: string;
        subject: string;
      }>(mail.sendMail);
      expect(mailed.html).not.toContain("<script>");
      expect(mailed.html).not.toContain("<img");
      expect(mailed.html).toContain("&lt;script&gt;");
      expect(mailed.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
      // Plain-text parts must stay literal, not show "&lt;" to the reader.
      expect(mailed.text).toContain("<img src=x onerror=alert(1)>");
    });
  });

  describe("listInvitations", () => {
    it("does not select the token", async () => {
      await service.listInvitations(workspaceId);

      const args = firstCallArg<{
        where: unknown;
        select: Record<string, boolean>;
      }>(prisma.invitation.findMany);
      expect(args.where).toEqual({ workspaceId });
      expect(args.select.id).toBe(true);
      expect(args.select.token).toBeUndefined();
    });
  });

  describe("acceptInvitation", () => {
    const token = "tok";
    const pendingInvite = (overrides: object = {}) => ({
      id: "inv-1",
      email: "bob@example.com",
      workspaceId,
      role: WorkspaceRole.MEMBER,
      status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + DAY),
      ...overrides,
    });

    beforeEach(() => {
      prisma.invitation.findUnique.mockResolvedValue(pendingInvite());
      prisma.auth.findUnique.mockResolvedValue({
        id: invitee.authId,
        userId: invitee.userId,
        email: "bob@example.com",
      });
    });

    it("finds the Auth row by userId (the JWT subject), not by its own id", async () => {
      await service.acceptInvitation(token, invitee.userId);

      expect(prisma.auth.findUnique).toHaveBeenCalledWith({
        where: { userId: invitee.userId },
      });
    });

    it("creates the membership for the User and marks the invite ACCEPTED", async () => {
      await expect(
        service.acceptInvitation(token, invitee.userId),
      ).resolves.toMatchObject({ workspaceId });

      expect(prisma.membership.create).toHaveBeenCalledWith({
        data: {
          userId: invitee.userId,
          workspaceId,
          role: WorkspaceRole.MEMBER,
        },
      });
      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: { status: InvitationStatus.ACCEPTED },
      });
    });

    it("matches the invited email case-insensitively", async () => {
      prisma.auth.findUnique.mockResolvedValue({
        userId: invitee.userId,
        email: "Bob@Example.COM",
      });

      await expect(
        service.acceptInvitation(token, invitee.userId),
      ).resolves.toBeDefined();
    });

    it("refuses a user whose email differs from the invitation", async () => {
      prisma.auth.findUnique.mockResolvedValue({
        userId: invitee.userId,
        email: "mallory@example.com",
      });

      await expect(
        service.acceptInvitation(token, invitee.userId),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.membership.create).not.toHaveBeenCalled();
    });

    it("404s when the caller has no Auth row", async () => {
      prisma.auth.findUnique.mockResolvedValue(null);

      await expect(
        service.acceptInvitation(token, invitee.userId),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("refuses a user who is already a member", async () => {
      prisma.membership.findUnique.mockResolvedValue({ id: "m-existing" });

      await expect(
        service.acceptInvitation(token, invitee.userId),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.membership.create).not.toHaveBeenCalled();
    });

    it("expires and refuses an out-of-date invitation", async () => {
      prisma.invitation.findUnique.mockResolvedValue(
        pendingInvite({ expiresAt: new Date(Date.now() - DAY) }),
      );

      await expect(
        service.acceptInvitation(token, invitee.userId),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.invitation.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: { status: InvitationStatus.EXPIRED },
      });
    });
  });
});
