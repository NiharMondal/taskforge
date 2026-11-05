import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import {
  MAX_ADMIN_REASON_LENGTH,
  PLATFORM_AUDIT_TARGET_TYPES,
  type PlatformAuditTargetType,
} from "@taskforge/shared";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

/**
 * Every admin action states why. It goes into the platform audit row, never
 * to the user.
 */
export class AdminReasonDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: "Give a reason" })
  @MaxLength(MAX_ADMIN_REASON_LENGTH)
  reason: string;
}

/** `PATCH /admin/users/:id` and `PATCH /admin/workspaces/:id`. */
export class SetSuspendedDto extends AdminReasonDto {
  /** `true` suspends, `false` lifts the suspension. */
  @IsBoolean()
  suspended: boolean;
}

/** `GET /admin/audit-log?targetType=&targetId=&page=&limit=`. */
export class QueryPlatformAuditLogDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(PLATFORM_AUDIT_TARGET_TYPES)
  targetType?: PlatformAuditTargetType;

  /** One user's or workspace's history (with `targetType`, or alone). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetId?: string;
}
