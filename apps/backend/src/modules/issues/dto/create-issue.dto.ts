import { IsOptionalNonNull } from "@/common/decorators/is-optional-non-null.decorator";
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { IssuePriority, IssueStatus } from "generated/prisma/enums";

export class CreateIssueDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptionalNonNull()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @IsOptionalNonNull()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @IsOptional()
  @IsUUID()
  sprintId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  /**
   * Creates a sub-issue of this issue (same project, one level deep). The new
   * issue is typed SUBTASK and, unless `sprintId` is sent, joins the parent's
   * sprint.
   */
  @IsOptional()
  @IsUUID()
  parentIssueId?: string;
}
