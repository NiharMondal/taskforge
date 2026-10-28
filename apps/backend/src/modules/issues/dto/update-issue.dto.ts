import { IsOptionalNonNull } from "@/common/decorators/is-optional-non-null.decorator";
import { IssueStatus, IssuePriority, IssueType } from "generated/prisma/enums";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import {
  ISSUE_TYPE_MESSAGE,
  MAX_STORY_POINTS,
  SELECTABLE_ISSUE_TYPES,
} from "./create-issue.dto";

export class UpdateIssueDto {
  @IsOptionalNonNull()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title?: string;

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

  /** A sub-issue's type (SUBTASK) can't be changed; the service refuses it. */
  @IsOptionalNonNull()
  @IsIn(SELECTABLE_ISSUE_TYPES, { message: ISSUE_TYPE_MESSAGE })
  type?: IssueType;

  /** Story points; `null` clears the estimate. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_STORY_POINTS)
  timeEstimate?: number | null;

  @IsOptional()
  @IsUUID()
  sprintId?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  /**
   * Board position within the target `(project, status)` lane: a base-62
   * fractional index computed by the client on drop (see `Issue.rank`). Sent
   * together with `status`; the charset check only rejects obvious junk — the
   * service validates that it is a usable key.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[0-9A-Za-z]+$/, {
    message: "rank must be a base-62 fractional index",
  })
  rank?: string;
}
