import { IsOptionalNonNull } from "@/common/decorators/is-optional-non-null.decorator";
import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateSprintDto {
  @IsOptionalNonNull()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  goal?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
