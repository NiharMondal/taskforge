import { IsOptionalNonNull } from "@/common/decorators/is-optional-non-null.decorator";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";
import { MAX_LABEL_NAME_LENGTH, trim } from "./create-label.dto";

export class UpdateLabelDto {
  @IsOptionalNonNull()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_LABEL_NAME_LENGTH)
  name?: string;

  @IsOptionalNonNull()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: "color must be a hex color like #22c55e",
  })
  color?: string;
}
