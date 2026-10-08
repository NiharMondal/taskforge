import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateWorkspaceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
