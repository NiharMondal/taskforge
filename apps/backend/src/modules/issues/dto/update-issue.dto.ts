import { IssueStatus, IssuePriority } from "generated/prisma/enums";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateIssueDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

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
