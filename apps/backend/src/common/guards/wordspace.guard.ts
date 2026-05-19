import { PrismaService } from "@/prisma/prisma.service";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: any = context.switchToHttp().getRequest();

    const user = request.user;
    const workspaceId = request.headers["x-workspace-id"];

    if (!user) {
      throw new ForbiddenException("User not authenticated");
    }

    if (!workspaceId) {
      throw new ForbiddenException("Workspace ID missing");
    }

    // Validate membership
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.sub,
          workspaceId: workspaceId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException("No access to this workspace");
    }

    // Attach to request (IMPORTANT)
    request.workspaceId = workspaceId;
    request.membershipRole = membership.role;

    return true;
  }
}
