import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { IsEnum, IsOptional, IsString, IsUUID, Matches } from "class-validator";
import { IssuePriority, IssueStatus } from "generated/prisma/enums";

export class QueryIssuesDto extends PaginationQueryDto {
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
}
