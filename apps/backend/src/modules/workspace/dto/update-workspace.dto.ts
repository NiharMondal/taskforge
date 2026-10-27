import { IsOptionalNonNull } from "@/common/decorators/is-optional-non-null.decorator";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateWorkspaceDto {
  @IsString()
  @IsOptionalNonNull()
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
