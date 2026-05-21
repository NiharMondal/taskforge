import { ROLES_KEY } from "@/common/decorators/roles.decorator";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
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

    if (
      !membershipRole ||
      !([WorkspaceRole.OWNER, WorkspaceRole.ADMIN] as WorkspaceRole[]).includes(
        membershipRole,
      )
    ) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return required.includes(membershipRole);
  }
}
