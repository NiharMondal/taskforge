import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MIN_PROJECT_NAME_LENGTH,
} from "@taskforge/shared";
import { IsOptionalNonNull } from "@/common/decorators/is-optional-non-null.decorator";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateProjectDto {
  @IsOptionalNonNull()
  @IsString()
  @MinLength(MIN_PROJECT_NAME_LENGTH)
  @MaxLength(MAX_NAME_LENGTH)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description?: string;
}
