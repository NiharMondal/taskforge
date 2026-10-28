import type { WorkspaceAccess } from "@/common/permissions/workspace-access";
import { PrismaService } from "@/prisma/prisma.service";
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";

/** Who wrote it, as every comment response embeds it. */
const WITH_AUTHOR = {
  user: { select: { id: true, name: true, avatarUrl: true } },
} as const;

/**
 * Comments on an issue. `Comment` has no `workspaceId`, so every query reaches
 * the tenant through its issue (`issue: { workspaceId, projectId }`); a
 * comment id from another workspace, project or issue reads as not found.
 */
@Injectable()
export class CommentService {
  constructor(private prisma: PrismaService) {}

  /** The issue's comments, oldest first. */
  async findAll(workspaceId: string, projectId: string, issueId: string) {
    await this.validateIssue(workspaceId, projectId, issueId);

    return this.prisma.comment.findMany({
      where: { issueId, issue: { workspaceId, projectId } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: WITH_AUTHOR,
    });
  }

  /** `comment:create` is checked on the route. */
  async create(
    workspaceId: string,
    projectId: string,
    issueId: string,
    userId: string,
    dto: CreateCommentDto,
  ) {
    await this.validateIssue(workspaceId, projectId, issueId);

    return this.prisma.comment.create({
      data: { content: dto.content, issueId, userId },
      include: WITH_AUTHOR,
    });
  }

  /** Only the author edits a comment; `comment:create` is checked on the route. */
  async update(
    workspaceId: string,
    projectId: string,
    issueId: string,
    commentId: string,
    access: WorkspaceAccess,
    dto: UpdateCommentDto,
  ) {
    const comment = await this.findOne(
      workspaceId,
      projectId,
      issueId,
      commentId,
    );

    if (comment.userId !== access.userId) {
      throw new ForbiddenException("You can only edit your own comments");
    }

    return this.prisma.comment.update({
      where: { id: comment.id },
      data: { content: dto.content },
      include: WITH_AUTHOR,
    });
  }

  /**
   * The author may delete their own comment while they can still comment;
   * `comment:delete:any` deletes anyone's.
   */
  async remove(
    workspaceId: string,
    projectId: string,
    issueId: string,
    commentId: string,
    access: WorkspaceAccess,
  ) {
    const comment = await this.findOne(
      workspaceId,
      projectId,
      issueId,
      commentId,
    );

    const ownsIt =
      comment.userId === access.userId &&
      access.permissions.has("comment:create");
    if (!ownsIt && !access.permissions.has("comment:delete:any")) {
      throw new ForbiddenException(
        "You do not have permission to delete this comment",
      );
    }

    return this.prisma.comment.delete({ where: { id: comment.id } });
  }

  private async findOne(
    workspaceId: string,
    projectId: string,
    issueId: string,
    commentId: string,
  ) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, issueId, issue: { workspaceId, projectId } },
    });

    if (!comment) {
      throw new NotFoundException("Comment not found");
    }

    return comment;
  }

  private async validateIssue(
    workspaceId: string,
    projectId: string,
    issueId: string,
  ) {
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, workspaceId, projectId },
      select: { id: true },
    });

    if (!issue) {
      throw new NotFoundException("Issue not found");
    }
  }
}
