import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { WorkspaceAccess } from "../permissions/workspace-access";
import { AuthenticatedRequest } from "../types/authenticated-request.interface";

/** The caller's workspace access (requires WorkspaceGuard). */
export const Access = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceAccess => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.access as WorkspaceAccess;
  },
);
