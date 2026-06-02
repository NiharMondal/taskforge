import { IsEmail, IsEnum, IsOptional } from "class-validator";
import { WorkspaceRole } from "generated/prisma/enums";

export class SendInvitationDto {
  @IsEmail()
  email: string;

  @IsEnum(WorkspaceRole)
  @IsOptional()
  role?: WorkspaceRole;
}
