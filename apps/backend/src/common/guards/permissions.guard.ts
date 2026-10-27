import { PrismaService } from "@/prisma/prisma.service";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Permission } from "../permissions/permissions";
import { resolveWorkspaceAccess } from "../permissions/workspace-access";
import { AuthenticatedRequest } from "../types/authenticated-request.interface";

/** Metadata key written by `@RequirePermission(...)`. */
export const REQUIRED_PERMISSIONS_KEY = "requiredPermissions";

/**
 * Enforces `@RequirePermission(...)`: the caller's role must hold every listed
 * permission. Resolves workspace access itself if WorkspaceGuard hasn't run
 * yet, so guard order can't silently skip the check.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const access = await resolveWorkspaceAccess(this.prisma, request);

    if (!required.every((permission) => access.permissions.has(permission))) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
