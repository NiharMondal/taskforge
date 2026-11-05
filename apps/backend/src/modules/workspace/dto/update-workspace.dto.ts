import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MIN_WORKSPACE_NAME_LENGTH,
} from "@taskforge/shared";
import { IsOptionalNonNull } from "@/common/decorators/is-optional-non-null.decorator";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateWorkspaceDto {
  @IsOptionalNonNull()
  @IsString()
  @MinLength(MIN_WORKSPACE_NAME_LENGTH) // as on create; an empty PATCH used to blank the name
  @MaxLength(MAX_NAME_LENGTH)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description?: string;
}
