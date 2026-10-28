import { Request } from "express";
import type { WorkspaceAccess } from "../permissions/workspace-access";

export interface AuthenticatedRequest extends Request {
  user: { sub: string };
  workspaceId?: string;
  /** Set by WorkspaceGuard / PermissionsGuard (see resolveWorkspaceAccess). */
  access?: WorkspaceAccess;
}
