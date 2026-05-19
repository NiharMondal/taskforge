import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "@/common/decorators/roles.decorator";
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

    // Workspace roles live in DB membership, not JWT claims.
    // Enforce role checks inside the service layer instead.
    return false;
  }
}
