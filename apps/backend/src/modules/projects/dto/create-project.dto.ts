import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MIN_PROJECT_NAME_LENGTH,
} from "@taskforge/shared";
import { IsOptionalNonNull } from "@/common/decorators/is-optional-non-null.decorator";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(MIN_PROJECT_NAME_LENGTH)
  @MaxLength(MAX_NAME_LENGTH)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description?: string;

  /**
   * Start with a copy of this project's workflow instead of the default
   * (spec/workflow-spec.md). Pro only: on Free it is a 402.
   */
  @IsOptionalNonNull()
  @IsUUID()
  workflowFromProjectId?: string;
}
