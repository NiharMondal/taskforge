import { WorkspaceRole } from "generated/prisma/enums";
import { accessFromMembership, WorkspaceAccess } from "./workspace-access";

/** A WorkspaceAccess for unit tests: a built-in role's default permissions. */
export function accessAs(
  role: WorkspaceRole,
  ids: Partial<Pick<WorkspaceAccess, "workspaceId" | "userId">> = {},
): WorkspaceAccess {
  return accessFromMembership(
    { role, roleId: null, assignedRole: null },
    { workspaceId: ids.workspaceId ?? "ws-1", userId: ids.userId ?? "user-1" },
  );
}
