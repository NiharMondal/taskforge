import { INVITABLE_ROLES } from "@taskforge/shared";
import { IsEmail, IsIn, IsOptional, IsUUID } from "class-validator";
import { WorkspaceRole } from "generated/prisma/enums";

/**
 * The role is `roleId` (any role but the owner's, custom ones included) or
 * `role`, a built-in's key kept for older clients; at most one. Neither means
 * Member.
 */
export class SendInvitationDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsIn(INVITABLE_ROLES)
  @IsOptional()
  role?: WorkspaceRole;
}
