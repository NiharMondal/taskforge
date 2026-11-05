import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { assertCanCustomizeWorkflow } from "@/common/plans/plan-limits";
import PrismaQueryBuilder from "@/lib/PrismQueryBuilder";
import { PrismaService } from "@/prisma/prisma.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "generated/prisma/client";
import { copyWorkflow, seedDefaultWorkflow } from "../workflows/seed-workflow";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { deriveProjectKey, firstFreeKey } from "./project-key";

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  /**
   * A project starts with a workflow: the default, or — on Pro — a copy of
   * another project's (`workflowFromProjectId`). Editing it afterwards is
   * `WorkflowService`'s.
   */
  async create(workspaceId: string, dto: CreateProjectDto) {
    const base = deriveProjectKey(dto.name);
    const source = dto.workflowFromProjectId;
    if (source) {
      await assertCanCustomizeWorkflow(this.prisma, workspaceId);
      await this.findOne(workspaceId, source);
    }

    // Two creates racing for the same key: the loser hits the unique index
    // and retries against the keys that now exist.
    for (let attempt = 1; ; attempt++) {
      const existing = await this.prisma.project.findMany({
        where: { workspaceId, key: { startsWith: base } },
        select: { key: true },
      });

      try {
        return await this.prisma.$transaction(async (tx) => {
          const project = await tx.project.create({
            data: {
              name: dto.name,
              description: dto.description,
              key: firstFreeKey(
                base,
                existing.map((p) => p.key),
              ),
              workspaceId,
            },
          });
          if (source) {
            await copyWorkflow(tx, workspaceId, source, project.id);
          } else {
            await seedDefaultWorkflow(tx, workspaceId, project.id);
          }
          return project;
        });
      } catch (error) {
        const isKeyClash =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002";
        if (!isKeyClash || attempt >= 3) throw error;
      }
    }
  }

  async findAll(workspaceId: string, query: PaginationQueryDto) {
    return new PrismaQueryBuilder(query, {
      defaultField: "createdAt",
      defaultOrder: "desc",
    })
      .withDefaultFilter({ workspaceId })
      .paginate()
      .sort()
      .include({
        _count: {
          select: {
            issues: true,
            sprints: true,
          },
        },
      })
      .execute(this.prisma.project);
  }

  async findOne(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
    });

    if (!project) {
      throw new NotFoundException("Project not found");
    }

    return project;
  }

  async update(workspaceId: string, projectId: string, dto: UpdateProjectDto) {
    await this.findOne(workspaceId, projectId);

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async delete(workspaceId: string, projectId: string) {
    await this.findOne(workspaceId, projectId);

    return this.prisma.project.delete({
      where: { id: projectId },
    });
  }
}
