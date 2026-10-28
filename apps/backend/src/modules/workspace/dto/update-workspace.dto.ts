import { IsOptionalNonNull } from "@/common/decorators/is-optional-non-null.decorator";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateWorkspaceDto {
  @IsOptionalNonNull()
  @IsString()
  @MinLength(3) // as on create; an empty PATCH used to blank the name
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
