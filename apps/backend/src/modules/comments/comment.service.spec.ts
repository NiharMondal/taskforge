import { accessAs } from "@/common/permissions/test-access";
import { WorkspaceAccess } from "@/common/permissions/workspace-access";
import { PrismaService } from "@/prisma/prisma.service";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { WorkspaceRole } from "generated/prisma/enums";
import { CommentService } from "./comment.service";

describe("CommentService", () => {
  const workspaceId = "ws-1";
  const projectId = "proj-1";
  const issueId = "issue-1";
  const commentId = "comment-1";
  const me = "user-me";

  let prisma: {
    issue: { findFirst: jest.Mock };
    comment: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let service: CommentService;

  /** The stored comment; written by someone else unless a test says so. */
  let author: string;

  beforeEach(() => {
    author = "user-other";
    prisma = {
      issue: { findFirst: jest.fn().mockResolvedValue({ id: issueId }) },
      comment: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(() =>
          Promise.resolve({
            id: commentId,
            issueId,
            userId: author,
            user: { id: author, name: "Author" },
          }),
        ),
        create: jest.fn().mockResolvedValue({ id: commentId }),
        update: jest.fn().mockResolvedValue({ id: commentId }),
        delete: jest.fn().mockResolvedValue({ id: commentId }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(prisma),
    );
    service = new CommentService(prisma as unknown as PrismaService);
  });

  const as = (role: WorkspaceRole) =>
    accessAs(role, { workspaceId, userId: me });
  const edit = (access: WorkspaceAccess) =>
    service.update(workspaceId, projectId, issueId, commentId, access, {
      content: "<p>Edited</p>",
    });
  const remove = (access: WorkspaceAccess) =>
    service.remove(workspaceId, projectId, issueId, commentId, access);

  describe("tenant isolation", () => {
    it("lists only through an issue in this workspace and project", async () => {
      await service.findAll(workspaceId, projectId, issueId);

      expect(prisma.issue.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: issueId, workspaceId, projectId },
        }),
      );
      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { issueId, issue: { workspaceId, projectId } },
        }),
      );
    });

    it("404s the thread of an issue outside the workspace or project", async () => {
      prisma.issue.findFirst.mockResolvedValue(null);

      await expect(
        service.findAll(workspaceId, projectId, issueId),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.comment.findMany).not.toHaveBeenCalled();
    });

    it("won't comment on an issue outside the workspace or project", async () => {
      prisma.issue.findFirst.mockResolvedValue(null);

      await expect(
        service.create(workspaceId, projectId, issueId, me, {
          content: "<p>Hi</p>",
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.comment.create).not.toHaveBeenCalled();
    });

    it("finds a comment only on this issue, project and workspace", async () => {
      author = me;
      await edit(as(WorkspaceRole.MEMBER));

      expect(prisma.comment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: commentId,
            issueId,
            issue: { workspaceId, projectId },
          },
        }),
      );
    });

    it.each([
      ["edits", () => edit(as(WorkspaceRole.OWNER))],
      ["deletes", () => remove(as(WorkspaceRole.OWNER))],
    ])(
      "404s and %s nothing when the comment isn't found there",
      async (_label, act) => {
        prisma.comment.findFirst.mockResolvedValue(null);

        await expect(act()).rejects.toBeInstanceOf(NotFoundException);
        expect(prisma.comment.update).not.toHaveBeenCalled();
        expect(prisma.comment.delete).not.toHaveBeenCalled();
      },
    );
  });

  it("writes a new comment as the caller", async () => {
    await service.create(workspaceId, projectId, issueId, me, {
      content: "<p>Hi</p>",
    });

    expect(prisma.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { content: "<p>Hi</p>", issueId, userId: me },
      }),
    );
  });

  describe("editing", () => {
    it("lets the author edit their comment", async () => {
      author = me;
      await edit(as(WorkspaceRole.MEMBER));

      expect(prisma.comment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: commentId },
          data: { content: "<p>Edited</p>" },
        }),
      );
    });

    it.each([WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER])(
      "refuses a %s editing someone else's comment",
      async (role) => {
        await expect(edit(as(role))).rejects.toBeInstanceOf(ForbiddenException);
        expect(prisma.comment.update).not.toHaveBeenCalled();
      },
    );
  });

  describe("deleting", () => {
    it("lets the author delete their comment", async () => {
      author = me;
      await remove(as(WorkspaceRole.MEMBER));

      expect(prisma.comment.delete).toHaveBeenCalledWith({
        where: { id: commentId },
      });
    });

    it("refuses an author who can no longer comment (now a VIEWER)", async () => {
      author = me;

      await expect(remove(as(WorkspaceRole.VIEWER))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.comment.delete).not.toHaveBeenCalled();
    });

    it("refuses a MEMBER deleting someone else's comment", async () => {
      await expect(remove(as(WorkspaceRole.MEMBER))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.comment.delete).not.toHaveBeenCalled();
    });

    it.each([WorkspaceRole.ADMIN, WorkspaceRole.OWNER])(
      "lets a %s delete anyone's comment",
      async (role) => {
        await remove(as(role));

        expect(prisma.comment.delete).toHaveBeenCalledTimes(1);
      },
    );

    it("records a moderator's deletion in the issue's history", async () => {
      await remove(as(WorkspaceRole.ADMIN));

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          userId: me,
          entityType: "ISSUE",
          entityId: issueId,
          action: "comment.deleted",
          metadata: { author: { id: "user-other", name: "Author" } },
        },
      });
    });

    it("records a deleted user's comment with a null author", async () => {
      prisma.comment.findFirst.mockResolvedValue({
        id: commentId,
        issueId,
        userId: null,
        user: null,
      });
      await remove(as(WorkspaceRole.ADMIN));

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "comment.deleted",
          metadata: { author: null },
        }) as unknown,
      });
    });

    it("refuses a MEMBER deleting a deleted user's comment", async () => {
      prisma.comment.findFirst.mockResolvedValue({
        id: commentId,
        issueId,
        userId: null,
        user: null,
      });

      await expect(remove(as(WorkspaceRole.MEMBER))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.comment.delete).not.toHaveBeenCalled();
    });

    it("doesn't record an author deleting their own comment", async () => {
      author = me;
      await remove(as(WorkspaceRole.ADMIN));

      expect(prisma.comment.delete).toHaveBeenCalledTimes(1);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });
});
