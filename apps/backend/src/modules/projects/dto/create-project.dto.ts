import {
  MAX_DESCRIPTION_LENGTH,
  MAX_NAME_LENGTH,
  MIN_PROJECT_NAME_LENGTH,
} from "@taskforge/shared";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
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
}
