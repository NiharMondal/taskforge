import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from "class-validator";
import { IssuePriority, IssueStatus } from "generated/prisma/enums";

export class QueryIssuesDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @IsOptional()
  @IsUUID()
  sprintId?: string;

  /**
   * `field:direction`, e.g. `rank:asc`. Declared so the whitelisting pipe
   * keeps it; the fields match `allowedFields` in `IssueService.findAll`.
   */
  @IsOptional()
  @Matches(/^(createdAt|priority|status|rank):(asc|desc)$/, {
    message:
      "sort must be one of createdAt, priority, status or rank, then :asc or :desc",
  })
  sort?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
