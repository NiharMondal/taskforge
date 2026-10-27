import { PrismaService } from "@/prisma/prisma.service";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { resolveWorkspaceAccess } from "../permissions/workspace-access";
import { AuthenticatedRequest } from "../types/authenticated-request.interface";

/**
 * Admits members of the workspace named by `x-workspace-id` (or the
 * `:workspaceId` param) and attaches `request.workspaceId` and
 * `request.access` (role + permissions). Route-level permission checks are
 * `@RequirePermission(...)`.
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    await resolveWorkspaceAccess(this.prisma, request);
    return true;
  }
}
