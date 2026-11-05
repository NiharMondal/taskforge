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
import { IssuePriority, IssueStatus, IssueType } from "generated/prisma/enums";

/**
 * The types a client may pick. SUBTASK isn't one: creating with
 * `parentIssueId` is what makes a sub-issue, and its type never changes.
 */
export const SELECTABLE_ISSUE_TYPES = [
  IssueType.EPIC,
  IssueType.STORY,
  IssueType.TASK,
  IssueType.BUG,
] as const;

export const ISSUE_TYPE_MESSAGE =
  "type must be EPIC, STORY, TASK or BUG (a sub-issue is created with parentIssueId)";

/** Upper bound for `timeEstimate`, which holds story points. */
export const MAX_STORY_POINTS = 100;

/** How many labels one issue can carry. */
export const MAX_ISSUE_LABELS = 10;

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
