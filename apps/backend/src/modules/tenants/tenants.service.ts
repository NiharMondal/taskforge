import { Injectable, ConflictException } from "@nestjs/common";
import { Role } from "generated/prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import { CreateTenantDto } from "@/modules/tenants/dto/create-tenant.dto";
import { generateSlug } from "@/utils/generate-slug";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTenantDto, userId: string) {
    const slug = generateSlug(dto.name);

    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) throw new ConflictException("Tenant name already taken");

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.name, slug },
      });
      await tx.membership.create({
        data: { userId, tenantId: tenant.id, role: Role.ADMIN },
      });
      return tenant;
    });
  }
}
