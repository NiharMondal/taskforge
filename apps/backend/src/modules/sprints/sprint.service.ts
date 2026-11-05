import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import PrismaQueryBuilder from "@/lib/PrismQueryBuilder";
import { PrismaService } from "@/prisma/prisma.service";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "generated/prisma/client";
import { StatusCategory } from "generated/prisma/enums";
import { CreateSprintDto } from "./dto/create-sprint.dto";
import { UpdateSprintDto } from "./dto/update-sprint.dto";

type Db = Pick<Prisma.TransactionClient, "sprint">;

/**
 * A sprint can't end before it starts; the same day is fine (the web form's
 * date pickers send both as the same instant). Either date may be absent.
 */
function assertDateOrder(
  startDate: Date | string | null | undefined,
  endDate: Date | string | null | undefined,
) {
  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    throw new BadRequestException("endDate must be on or after startDate");
  }
}

@Injectable()
export class SprintService {
  constructor(private prisma: PrismaService) {}

  // CREATE
  async create(workspaceId: string, projectId: string, dto: CreateSprintDto) {
    await this.validateProject(workspaceId, projectId);
    assertDateOrder(dto.startDate, dto.endDate);

    return this.prisma.sprint.create({
      data: {
        ...dto,
        workspaceId,
        projectId,
      },
    });
  }

  // GET ALL
  async findAll(
    workspaceId: string,
    projectId: string,
    query: PaginationQueryDto,
  ) {
    return new PrismaQueryBuilder(query, {
      defaultField: "createdAt",
      defaultOrder: "desc",
    })
      .withDefaultFilter({ workspaceId, projectId })
      .paginate()
      .sort()
      .execute(this.prisma.sprint);
  }

  // Update sprint
  async updateSprint(
    workspaceId: string,
    projectId: string,
    sprintId: string,
    dto: UpdateSprintDto,
  ) {
    await this.validateProject(workspaceId, projectId);
    const sprint = await this.getSprint(
      this.prisma,
      workspaceId,
      projectId,
      sprintId,
    );
    // A field the PATCH leaves out keeps its stored value; `null` clears it.
    assertDateOrder(
      dto.startDate !== undefined ? dto.startDate : sprint.startDate,
      dto.endDate !== undefined ? dto.endDate : sprint.endDate,
    );

    return this.prisma.sprint.update({
      where: { id: sprintId, projectId, workspaceId },
      data: {
        ...dto,
      },
    });
  }

  // START SPRINT
  async startSprint(workspaceId: string, projectId: string, sprintId: string) {
    // Locked per project: two starts at once would each see no active sprint
    // and both go ahead. The lock is released when the transaction ends.
    return this.prisma.$transaction(async (tx) => {
      const lock = `sprint-start:${projectId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}::text, 0))`;

      const sprint = await this.getSprint(tx, workspaceId, projectId, sprintId);

      if (sprint.completedAt) {
        throw new BadRequestException(
          "This sprint has ended and can't be started again",
        );
      }

      // ❗ Only one active sprint per project
      const activeSprint = await tx.sprint.findFirst({
        where: { projectId, workspaceId, isActive: true },
      });

      if (activeSprint) {
        throw new ForbiddenException(
          activeSprint.id === sprintId
            ? "This sprint is already active"
            : "Another sprint is already active in this project",
        );
      }

      return tx.sprint.update({
        where: { id: sprintId },
        data: {
          isActive: true,
          startDate: new Date(),
        },
      });
    });
  }

  // END SPRINT
  async endSprint(workspaceId: string, projectId: string, sprintId: string) {
    const sprint = await this.getSprint(
      this.prisma,
      workspaceId,
      projectId,
      sprintId,
    );

    if (!sprint.isActive) {
      throw new ForbiddenException("Sprint is not active");
    }

    return this.prisma.$transaction(async (tx) => {
      // Unfinished issues (any status not in the COMPLETED category) go back
      // to the backlog; their status is kept.
      await tx.issue.updateMany({
        where: {
          sprintId,
          workspaceId,
          status: { category: { not: StatusCategory.COMPLETED } },
        },
        data: {
          sprintId: null,
        },
      });

      const now = new Date();
      return tx.sprint.update({
        where: { id: sprintId },
        data: {
          isActive: false,
          endDate: now,
          completedAt: now,
        },
      });
    });
  }

  // HELPERS

  /** The sprint, if it belongs to this workspace *and* the project in the URL. */
  private async getSprint(
    db: Db,
    workspaceId: string,
    projectId: string,
    sprintId: string,
  ) {
    const sprint = await db.sprint.findFirst({
      where: { id: sprintId, workspaceId, projectId },
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
}
