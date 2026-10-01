import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";
import { WorkspaceRole } from "generated/prisma/enums";

export const MembershipRole = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): WorkspaceRole => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { membershipRole: WorkspaceRole }>();
    return request.membershipRole;
  },
);
