import {
  INVITATION_STATUS_VALUES,
  ISSUE_PRIORITY_VALUES,
  ISSUE_STATUS_VALUES,
  ISSUE_TYPE_VALUES,
  WORKSPACE_ROLE_VALUES,
} from "@taskforge/shared";
import {
  InvitationStatus,
  IssuePriority,
  IssueStatus,
  IssueType,
  WorkspaceRole,
} from "generated/prisma/enums";

/**
 * `@taskforge/shared` restates the schema's enums for the web. The schema is
 * the source of truth: an enum changed in `schema.prisma` without updating
 * `packages/shared/src/enums.ts` fails here.
 */
describe("shared enums match the Prisma schema", () => {
  it.each([
    ["WorkspaceRole", WORKSPACE_ROLE_VALUES, WorkspaceRole],
    ["IssueStatus", ISSUE_STATUS_VALUES, IssueStatus],
    ["IssuePriority", ISSUE_PRIORITY_VALUES, IssuePriority],
    ["IssueType", ISSUE_TYPE_VALUES, IssueType],
    ["InvitationStatus", INVITATION_STATUS_VALUES, InvitationStatus],
  ] as const)("%s", (_name, shared, prisma) => {
    // Same values in the same order (the web lists statuses in this order).
    expect([...shared]).toEqual(Object.values(prisma));
  });
});
