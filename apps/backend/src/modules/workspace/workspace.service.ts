import { generateSlug } from "@/common/utils/generate-slug";
import { PrismaService } from "@/prisma/prisma.service";
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { WorkspaceRole } from "generated/prisma/enums";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  // create workspace
  async create(userId: string, name: string) {
    const suffix = Math.random().toString(36).substring(2, 8);
    const slug = `${generateSlug(name)}-${suffix}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name,
          slug,
        },
      });

      await tx.membership.create({
        data: {
          userId,
          workspaceId: workspace.id,
          role: WorkspaceRole.OWNER,
        },
      });

      return { workspace };
    });

    return result;
  }

  // get user workspace
  async getUserWorkspaces(userId: string) {
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        memberships: {
          some: { userId },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return workspaces;
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
