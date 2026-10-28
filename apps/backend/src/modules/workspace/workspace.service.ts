import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import PrismaQueryBuilder from "@/lib/PrismQueryBuilder";
import { PrismaService } from "@/prisma/prisma.service";
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceRole } from "generated/prisma/enums";
import { seedSystemRoles } from "../roles/system-roles";
import { CreateWorkspaceDto } from "./dto/create-workspace.dto";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  // create workspace
  async create(userId: string, dto: CreateWorkspaceDto) {
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

  // get user workspace
  async getUserWorkspaces(userId: string, query: PaginationQueryDto) {
    return new PrismaQueryBuilder(query, {
      defaultField: "createdAt",
      defaultOrder: "desc",
    })
      .withDefaultFilter({ memberships: { some: { userId } } })
      .paginate()
      .sort()
      .execute(this.prisma.workspace);
  }

  // get single workspace
  async findOne(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    // check membership
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException("Not a member of this workspace");
    }

    return workspace;
  }
  // update workspace
  async update(workspaceId: string, data: UpdateWorkspaceDto) {
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  // delete workspace (only admin)
  async delete(workspaceId: string) {
    return this.prisma.workspace.delete({
      where: { id: workspaceId },
    });
  }
}
