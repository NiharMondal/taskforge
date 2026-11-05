import { IsEnum, IsOptional, IsUUID } from "class-validator";
import { WorkspaceRole } from "generated/prisma/enums";

/**
 * The role to give a member: `roleId` (any role of the workspace, custom ones
 * included), or `role`, a built-in's key, kept for older clients. Exactly one.
 */
export class UpdateRoleDto {
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsEnum(WorkspaceRole)
  role?: WorkspaceRole;
}
