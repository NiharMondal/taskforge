import { ROLES_KEY } from "@/common/decorators/roles.decorator";
import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
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

    const request = context
      .switchToHttp()
      .getRequest<{ membershipRole: WorkspaceRole }>();
    const membershipRole = request.membershipRole;

    if (!membershipRole) return false;

    return required.includes(membershipRole);
  }
}
