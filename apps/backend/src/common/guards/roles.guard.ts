import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "@/common/decorators/roles.decorator";
import type { JwtPayload } from "@/modules/auth/strategies/jwt.strategy";
import { WorkspaceRole } from "generated/prisma/enums";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) return true;

    const user = context
      .switchToHttp()
      .getRequest<{ user?: JwtPayload }>().user;
    return required.some((r) => user?.roles.includes(r));
  }
}
