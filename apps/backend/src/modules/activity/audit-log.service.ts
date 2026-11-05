import PrismaQueryBuilder from "@/lib/PrismQueryBuilder";
import { PrismaService } from "@/prisma/prisma.service";
import { Injectable } from "@nestjs/common";
import { AUDIT_ENTITY_TYPES } from "@taskforge/shared";
import { QueryAuditLogDto } from "./dto/query-audit-log.dto";

/** What a row of the audit log returns: the actor by name, not the whole user. */
const AUDIT_ROW_SELECT = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  metadata: true,
  createdAt: true,
  user: { select: { id: true, name: true, avatarUrl: true } },
} as const;

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The workspace's audit log, newest first, one page at a time. Issue history
   * shares the table but has its own route, so only the workspace entity types
   * are read (`AUDIT_ENTITY_TYPES`), or the one asked for.
   */
  async findAll(workspaceId: string, query: QueryAuditLogDto) {
    return new PrismaQueryBuilder(query, {
      defaultField: "createdAt",
      defaultOrder: "desc",
    })
      .withDefaultFilter({
        workspaceId,
        entityType: query.entityType ?? { in: [...AUDIT_ENTITY_TYPES] },
      })
      .paginate()
      .sort()
      .select(AUDIT_ROW_SELECT)
      .execute(this.prisma.auditLog);
  }
}
