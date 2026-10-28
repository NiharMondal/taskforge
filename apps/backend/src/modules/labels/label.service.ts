import { PrismaService } from "@/prisma/prisma.service";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateLabelDto } from "./dto/create-label.dto";
import { UpdateLabelDto } from "./dto/update-label.dto";

/**
 * The workspace's labels. Applying them to issues is the issue routes' job
 * (`labelIds`); deleting a label removes it from every issue (cascade).
 */
@Injectable()
export class LabelService {
  constructor(private prisma: PrismaService) {}

  /** Alphabetical, each with how many issues carry it. */
  findAll(workspaceId: string) {
    return this.prisma.label.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      include: { _count: { select: { issues: true } } },
    });
  }

  async create(workspaceId: string, dto: CreateLabelDto) {
    await this.assertNameFree(workspaceId, dto.name);

    return this.prisma.label.create({
      data: { name: dto.name, color: dto.color, workspaceId },
    });
  }

  async update(workspaceId: string, labelId: string, dto: UpdateLabelDto) {
    await this.findOne(workspaceId, labelId);
    if (dto.name !== undefined) {
      await this.assertNameFree(workspaceId, dto.name, labelId);
    }

    return this.prisma.label.update({
      where: { id: labelId },
      data: { name: dto.name, color: dto.color },
    });
  }

  async remove(workspaceId: string, labelId: string) {
    await this.findOne(workspaceId, labelId);

    return this.prisma.label.delete({ where: { id: labelId } });
  }

  private async findOne(workspaceId: string, labelId: string) {
    const label = await this.prisma.label.findFirst({
      where: { id: labelId, workspaceId },
    });

    if (!label) {
      throw new NotFoundException("Label not found");
    }

    return label;
  }

  /**
   * `@@unique([workspaceId, name])` is case-sensitive, so "Bug" and "bug"
   * would both pass it; refuse that here with a readable message. (A race
   * on the exact same name still hits the index and answers 409 too.)
   */
  private async assertNameFree(
    workspaceId: string,
    name: string,
    exceptLabelId?: string,
  ) {
    const taken = await this.prisma.label.findFirst({
      where: {
        workspaceId,
        name: { equals: name, mode: "insensitive" },
        ...(exceptLabelId && { id: { not: exceptLabelId } }),
      },
      select: { id: true },
    });

    if (taken) {
      throw new ConflictException(`A label named "${name}" already exists`);
    }
  }
}
