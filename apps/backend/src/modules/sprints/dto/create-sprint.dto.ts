import { IsOptional, IsString, IsDateString } from "class-validator";

export class CreateSprintDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
