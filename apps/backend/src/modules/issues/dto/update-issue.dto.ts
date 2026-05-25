import { IssueStatus, IssuePriority } from "generated/prisma/enums";
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
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
}
