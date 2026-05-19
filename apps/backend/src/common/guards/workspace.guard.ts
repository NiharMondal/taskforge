import { PrismaService } from "@/prisma/prisma.service";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Request } from "express";
import { JwtPayload } from "@/modules/auth/strategies/jwt.strategy";

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as JwtPayload;

    const rawHeader = request.headers["x-workspace-id"];
    const workspaceId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (!user) {
      throw new ForbiddenException("User not authenticated");
    }

    if (!workspaceId) {
      throw new ForbiddenException("Workspace ID missing");
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.sub,
          workspaceId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException("No access to this workspace");
    }

    (request as Request & { workspaceId: string; membershipRole: string }).workspaceId = workspaceId;
    (request as Request & { workspaceId: string; membershipRole: string }).membershipRole = membership.role;

    return true;
  }
}
