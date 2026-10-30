import { ForbiddenException } from "@nestjs/common";
import { StatusCategory } from "generated/prisma/enums";
import { Permission } from "@taskforge/shared";
import { WorkspaceAccess } from "./workspace-access";

/**
 * Which permission each writable issue field needs. This is an allow-list: a
 * field missing from it is refused, so a field added to the DTO stays locked
 * until someone decides who may write it here.
 */
const FIELD_RULES = {
  title: "content",
  description: "content",
  priority: "content",
  type: "content",
  timeEstimate: "content",
  sprintId: "content",
  assigneeId: "content",
  labelIds: "content",
  statusId: "status",
  rank: "status",
} as const satisfies Record<string, "content" | "status">;

const UPDATE_PERMISSIONS: Permission[] = [
  "issue:edit:any",
  "issue:edit:own",
  "issue:status",
];

const has = (access: WorkspaceAccess, permission: Permission) =>
  access.permissions.has(permission);

/** Refuse a caller who can't change any issue, before anything is read. */
export function assertCanUpdateSomeIssue(access: WorkspaceAccess) {
  if (!UPDATE_PERMISSIONS.some((p) => has(access, p))) {
    throw new ForbiddenException("You do not have permission to update issues");
  }
}

/**
 * Moving an issue into a COMPLETED status takes its own permission, on create
 * and update alike. Takes the target status's category, never its name: the
 * project names its statuses.
 */
export function assertCanSetStatus(
  access: WorkspaceAccess,
  category: StatusCategory | undefined,
) {
  if (
    category === StatusCategory.COMPLETED &&
    !has(access, "issue:status:done")
  ) {
    throw new ForbiddenException(
      "You do not have permission to complete issues",
    );
  }
}

/**
 * Field-level check for a PATCH. `issue` is the row as stored: ownership is
 * decided before the update, so assigning yourself in the same request doesn't
 * make the issue yours. The target status's category is checked apart, with
 * `assertCanSetStatus`, once the service has resolved it.
 */
export function assertCanUpdateIssue(
  access: WorkspaceAccess,
  issue: { reporterId: string | null; assigneeId: string | null },
  dto: object,
) {
  const owns =
    issue.reporterId === access.userId || issue.assigneeId === access.userId;
  const canEditContent =
    has(access, "issue:edit:any") || (owns && has(access, "issue:edit:own"));

  for (const [field, value] of Object.entries(dto)) {
    if (value === undefined) continue;

    const rule = FIELD_RULES[field as keyof typeof FIELD_RULES];

    if (rule === "status") {
      if (!has(access, "issue:status")) {
        throw new ForbiddenException(
          "You do not have permission to change the issue status",
        );
      }
    } else if (rule === "content") {
      if (!canEditContent) {
        throw new ForbiddenException(
          owns || !has(access, "issue:edit:own")
            ? "You do not have permission to edit this issue"
            : "You can only edit issues you reported or are assigned to",
        );
      }
    } else {
      throw new ForbiddenException(`"${field}" cannot be updated`);
    }
  }
}
