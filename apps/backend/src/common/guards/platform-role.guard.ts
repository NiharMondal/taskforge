import { PrismaService } from "@/prisma/prisma.service";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PlatformRole } from "generated/prisma/enums";
import { AuthenticatedRequest } from "../types/authenticated-request.interface";

/** Metadata key written by `@RequirePlatformRole(...)`. */
export const REQUIRED_PLATFORM_ROLE_KEY = "requiredPlatformRole";

/**
 * What each platform role may do, lowest first: ADMIN can do everything
 * SUPPORT can. A route names the least role it needs.
 */
const PLATFORM_ROLE_RANK: Record<PlatformRole, number> = {
  [PlatformRole.SUPPORT]: 1,
  [PlatformRole.ADMIN]: 2,
};

/** Whether `held` (the caller's role, if any) is at least `required`. */
export function platformRoleSatisfies(
  held: PlatformRole | null | undefined,
  required: PlatformRole,
): boolean {
  return !!held && PLATFORM_ROLE_RANK[held] >= PLATFORM_ROLE_RANK[required];
}

/**
 * Enforces `@RequirePlatformRole(...)` (`spec/admin-spec.md`). The role lives
 * on the `User` row, never in the JWT, so it is read from the database on
 * every request: clearing it takes effect at once, even for a token that is
 * still valid. Runs after the global JwtAuthGuard, so `request.user` is set.
 */
@Injectable()
export class PlatformRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PlatformRole>(
      REQUIRED_PLATFORM_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );
    // Applied only through the decorator, which always sets a role; refuse
    // rather than let a misconfigured route through.
    if (!required) {
      throw new ForbiddenException("Platform access required");
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;
    if (!userId) {
      throw new ForbiddenException("Platform access required");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { platformRole: true },
    });

    if (!platformRoleSatisfies(user?.platformRole, required)) {
      throw new ForbiddenException("Platform access required");
    }

    return true;
  }
}
