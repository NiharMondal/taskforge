import { IsEmail, IsIn, IsOptional } from "class-validator";
import { WorkspaceRole } from "generated/prisma/enums";

/** Roles an invitation may grant. OWNER is never granted by invitation. */
export const INVITABLE_ROLES = [
  WorkspaceRole.ADMIN,
  WorkspaceRole.MEMBER,
  WorkspaceRole.VIEWER,
];

export class SendInvitationDto {
  @IsEmail()
  email: string;

  @IsIn(INVITABLE_ROLES)
  @IsOptional()
  role?: WorkspaceRole;
}
