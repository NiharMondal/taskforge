import {
  MAX_ISSUE_DESCRIPTION_LENGTH,
  MAX_ISSUE_LABELS,
  MAX_ISSUE_TITLE_LENGTH,
  MAX_STORY_POINTS,
  MIN_ISSUE_TITLE_LENGTH,
  SELECTABLE_ISSUE_TYPES,
} from "@taskforge/shared";
import { IsOptionalNonNull } from "@/common/decorators/is-optional-non-null.decorator";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { IssuePriority, IssueType } from "generated/prisma/enums";

export const ISSUE_TYPE_MESSAGE =
  "type must be EPIC, STORY, TASK or BUG (a sub-issue is created with parentIssueId)";

export class CreateIssueDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(MIN_ISSUE_TITLE_LENGTH)
  @MaxLength(MAX_ISSUE_TITLE_LENGTH)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_ISSUE_DESCRIPTION_LENGTH)
  description?: string;

  /**
   * A status of this project's workflow (`GET /projects/:projectId/workflow`).
   * Left out on create, the project's default.
   */
  @IsOptionalNonNull()
  @IsUUID()
  statusId?: string;

  @IsOptionalNonNull()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  /** Defaults to TASK (the schema default). Not allowed with `parentIssueId`. */
  @IsOptionalNonNull()
  @IsIn(SELECTABLE_ISSUE_TYPES, { message: ISSUE_TYPE_MESSAGE })
  type?: IssueType;

  /** Story points, despite the column name. `null` means not estimated. */
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

  /** Labels of this workspace (see `/labels`). */
  @IsOptionalNonNull()
  @IsArray()
  @ArrayMaxSize(MAX_ISSUE_LABELS)
  @ArrayUnique()
  @IsUUID("all", { each: true })
  labelIds?: string[];

  /**
   * Creates a sub-issue of this issue (same project, one level deep). The new
   * issue is typed SUBTASK and, unless `sprintId` is sent, joins the parent's
   * sprint.
   */
  @IsOptional()
  @IsUUID()
  parentIssueId?: string;
}
