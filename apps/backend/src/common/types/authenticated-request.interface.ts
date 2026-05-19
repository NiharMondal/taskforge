import { Request } from "express";

export interface AuthenticatedRequest extends Request {
  user: { sub: string };
  workspaceId: string;
  membershipRole: string;
}
