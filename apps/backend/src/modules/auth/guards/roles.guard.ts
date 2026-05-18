import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "generated/prisma/client";
import { ROLES_KEY } from "@/modules/auth/decorators/roles.decorator";
import type { JwtPayload } from "@/modules/auth/strategies/jwt.strategy";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest<{ user?: JwtPayload }>()
      .user;
    return required.some((r) => user?.roles?.includes(r));
  }
}
