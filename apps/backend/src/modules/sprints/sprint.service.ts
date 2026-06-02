import { PrismaService } from "@/prisma/prisma.service";
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceRole } from "generated/prisma/enums";
import { CreateSprintDto } from "./dto/create-sprint.dto";

@Injectable()
export class SprintService {
  constructor(private prisma: PrismaService) {}

  // CREATE
  async create(
    workspaceId: string,
    projectId: string,
    role: WorkspaceRole,
    dto: CreateSprintDto,
  ) {
    this.ensureManager(role);

    await this.validateProject(workspaceId, projectId);

    return this.prisma.sprint.create({
      data: {
        ...dto,
        workspaceId,
        projectId,
      },
    });
  }

  // GET ALL
  async findAll(workspaceId: string, projectId: string) {
    return this.prisma.sprint.findMany({
      where: { workspaceId, projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  // START SPRINT
  async startSprint(
    workspaceId: string,
    sprintId: string,
    role: WorkspaceRole,
  ) {
    this.ensureManager(role);

    const sprint = await this.getSprint(workspaceId, sprintId);

    // ❗ Only one active sprint per project
    const activeSprint = await this.prisma.sprint.findFirst({
      where: {
        projectId: sprint.projectId,
        workspaceId,
        isActive: true,
      },
    });

    if (activeSprint) {
      throw new ForbiddenException(
        "Another sprint is already active in this project",
      );
    }

    return this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        isActive: true,
        startDate: new Date(),
      },
    });
  }

  // END SPRINT
  async endSprint(workspaceId: string, sprintId: string, role: WorkspaceRole) {
    this.ensureManager(role);

    const sprint = await this.getSprint(workspaceId, sprintId);

    if (!sprint.isActive) {
      throw new ForbiddenException("Sprint is not active");
    }

    return this.prisma.$transaction(async (tx) => {
      // Move unfinished issues back to backlog
      await tx.issue.updateMany({
        where: {
          sprintId,
          status: { not: "DONE" },
        },
        data: {
          sprintId: null,
        },
      });

      return tx.sprint.update({
        where: { id: sprintId },
        data: {
          isActive: false,
          endDate: new Date(),
        },
      });
    });
  }

  // ASSIGN ISSUE TO SPRINT
  async addIssue(workspaceId: string, sprintId: string, issueId: string) {
    const sprint = await this.getSprint(workspaceId, sprintId);

    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, workspaceId },
    });

    if (!issue) throw new NotFoundException("Issue not found");

    // ❗ Must belong to same project
    if (issue.projectId !== sprint.projectId) {
      throw new ForbiddenException(
        "Issue must belong to the same project as sprint",
      );
    }

    return this.prisma.issue.update({
      where: { id: issueId },
      data: { sprintId },
    });
  }

  // REMOVE ISSUE FROM SPRINT
  async removeIssue(workspaceId: string, issueId: string) {
    const issue = await this.prisma.issue.findFirst({
      where: { id: issueId, workspaceId },
    });

    if (!issue) throw new NotFoundException("Issue not found");

    return this.prisma.issue.update({
      where: { id: issueId },
      data: { sprintId: null },
    });
  }

  // HELPERS

  private async getSprint(workspaceId: string, sprintId: string) {
    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, workspaceId },
    });

    if (!sprint) throw new NotFoundException("Sprint not found");

    return sprint;
  }

  private async validateProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
    });

    if (!project) throw new NotFoundException("Project not found");
  }

  private ensureManager(role: WorkspaceRole) {
    if (role === WorkspaceRole.VIEWER || role === WorkspaceRole.MEMBER) {
      throw new ForbiddenException("Insufficient permissions");
    }
  }
}
