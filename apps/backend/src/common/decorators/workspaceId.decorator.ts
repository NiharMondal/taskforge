import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const WorkspaceId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Record<string, unknown>>();

    if (!request.workspaceId) {
      throw new Error(
        "WorkspaceId not found in request. Did you forget WorkspaceGuard?",
      );
    }

    return request.workspaceId as string;
  },
);
