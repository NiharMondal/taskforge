import { PrismaService } from "@/prisma/prisma.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { ISSUE_ENTITY } from "./issue-activity";

/** Reads issue history; the writes happen beside each change (`issue-activity.ts`). */
@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  /** An issue's history, oldest first, each row with who did it. */
  async findForIssue(workspaceId: string, projectId: string, issueId: string) {
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, workspaceId, projectId },
      select: { id: true },
    });

    if (!issue) {
      throw new NotFoundException("Issue not found");
    }

    return this.prisma.auditLog.findMany({
      where: { workspaceId, entityType: ISSUE_ENTITY, entityId: issueId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        action: true,
        metadata: true,
        createdAt: true,
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }
}
