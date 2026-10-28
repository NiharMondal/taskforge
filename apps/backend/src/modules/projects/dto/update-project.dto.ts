import { IsOptionalNonNull } from "@/common/decorators/is-optional-non-null.decorator";
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateProjectDto {
  @IsOptionalNonNull()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
