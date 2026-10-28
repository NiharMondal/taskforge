import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from "@taskforge/shared";
import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateSprintDto {
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  goal?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
