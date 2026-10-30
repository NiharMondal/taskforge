import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { AUDIT_ENTITY_TYPES, type AuditEntityType } from "@taskforge/shared";
import { IsIn, IsOptional } from "class-validator";

/** `GET /audit-log?entityType=&page=&limit=`. */
export class QueryAuditLogDto extends PaginationQueryDto {
  /** Only rows about members, invitations, roles, the workspace or billing. */
  @IsOptional()
  @IsIn(AUDIT_ENTITY_TYPES)
  entityType?: AuditEntityType;
}
