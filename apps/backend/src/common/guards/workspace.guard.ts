import { JwtPayload } from "@/common/strategies/jwt.strategy";
import { PrismaService } from "@/prisma/prisma.service";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { AuthenticatedRequest } from "../types/authenticated-request.interface";

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user as JwtPayload;

    if (!user) {
      throw new ForbiddenException("User not authenticated");
    }

    const rawHeader = request.headers["x-workspace-id"];
    const headerId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const paramId = request.params["workspaceId"];

    // Membership is checked against exactly one id, and the route acts on the
    // path param. If the two disagree the check would authorize workspace A
    // while the handler operates on workspace B, so reject instead of guessing.
    if (headerId && paramId && headerId !== paramId) {
      throw new ForbiddenException(
        "x-workspace-id header does not match the workspace in the path",
      );
    }

    const workspaceId = headerId ?? paramId;

    if (!workspaceId) {
      throw new ForbiddenException("Workspace ID missing");
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.sub,
          workspaceId: workspaceId as string,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException("No access to this workspace");
    }

    request.workspaceId = workspaceId as string;
    request.membershipRole = membership.role;

    return true;
  }
}
