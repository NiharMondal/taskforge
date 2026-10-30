import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { assertCanOwnAnotherFreeWorkspace } from "@/common/plans/plan-limits";
import PrismaQueryBuilder from "@/lib/PrismQueryBuilder";
import { PrismaService } from "@/prisma/prisma.service";
import { Injectable, NotFoundException } from "@nestjs/common";
import { effectivePlan } from "@taskforge/shared";
import type { Prisma, Subscription, Workspace } from "generated/prisma/client";
import { WorkspaceRole } from "generated/prisma/enums";
import { BillingService } from "../billing/billing.service";
import { seedSystemRoles } from "../roles/system-roles";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";
import { recordWorkspaceEvent } from "../activity/workspace-activity";

/** A `GET /workspaces` row before its subscription becomes `plan`. */
type WorkspaceRow = Workspace & {
  subscription: Pick<Subscription, "plan" | "status"> | null;
};

@Injectable()
export class WorkspaceService {
  constructor(
    private prisma: PrismaService,
    private billing: BillingService,
  ) {}

  // create workspace — the caller's Free workspaces are capped (402)
  async create(userId: string, dto: CreateWorkspaceDto) {
    await assertCanOwnAnotherFreeWorkspace(this.prisma, userId);

    const result = await this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name,
          description: dto.description,
        },
      });

      const roleIds = await seedSystemRoles(tx, workspace.id);
      await tx.membership.create({
        data: {
          userId,
          workspaceId: workspace.id,
          role: WorkspaceRole.OWNER,
          roleId: roleIds[WorkspaceRole.OWNER],
        },
      });

      return { workspace };
    });

    return result;
  }

  // get user workspace, each with the plan it is on now
  async getUserWorkspaces(userId: string, query: PaginationQueryDto) {
    const { data, metaData } =
      await new PrismaQueryBuilder<Prisma.WorkspaceWhereInput>(query, {
        defaultField: "createdAt",
        defaultOrder: "desc",
      })
        .withDefaultFilter({ memberships: { some: { userId } } })
        .paginate()
        .sort()
        .include({ subscription: { select: { plan: true, status: true } } })
        .execute(this.prisma.workspace);

    return {
      data: (data as WorkspaceRow[]).map(({ subscription, ...workspace }) => ({
        ...workspace,
        plan: effectivePlan(subscription),
      })),
      metaData,
    };
  }

  // get single workspace — WorkspaceGuard has already proven membership
  async findOne(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    return workspace;
  }
  // update workspace (`workspace:manage` is checked on the route)
  async update(workspaceId: string, actorId: string, data: UpdateWorkspaceDto) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.workspace.findUniqueOrThrow({
        where: { id: workspaceId },
        select: { name: true, description: true },
      });
      const updated = await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          name: data.name,
          description: data.description,
        },
      });

      // Only what actually changed; the description itself isn't copied.
      const renamed = updated.name !== before.name;
      const described = updated.description !== before.description;
      if (renamed || described) {
        await recordWorkspaceEvent(tx, {
          workspaceId,
          userId: actorId,
          action: "workspace.updated",
          entityId: workspaceId,
          metadata: {
            ...(renamed && { name: { from: before.name, to: updated.name } }),
            ...(described && { description: true as const }),
          },
        });
      }
      return updated;
    });
  }

  // delete workspace (owner only). A paid subscription is canceled first; if
  // Stripe can't be reached the delete is refused rather than left billing.
  async delete(workspaceId: string) {
    await this.billing.cancelForDeletion(workspaceId);
    return this.prisma.workspace.delete({
      where: { id: workspaceId },
    });
  }
}
