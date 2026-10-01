import { Request } from "express";
import { WorkspaceRole } from "generated/prisma/enums";

export interface AuthenticatedRequest extends Request {
  user: { sub: string };
  workspaceId?: string;
  membershipRole?: WorkspaceRole;
}
