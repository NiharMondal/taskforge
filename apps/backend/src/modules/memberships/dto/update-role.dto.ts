import { IsEnum } from "class-validator";
import { WorkspaceRole } from "generated/prisma/enums";

export class UpdateRoleDto {
  @IsEnum(WorkspaceRole)
  role: WorkspaceRole;
}
