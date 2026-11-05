import {
  INVITATION_STATUS_VALUES,
  ISSUE_PRIORITY_VALUES,
  ISSUE_TYPE_VALUES,
  STATUS_CATEGORY_VALUES,
  SUBSCRIPTION_PLAN_VALUES,
  SUBSCRIPTION_STATUS_VALUES,
  WORKSPACE_ROLE_VALUES,
} from "@taskforge/shared";
import {
  InvitationStatus,
  IssuePriority,
  IssueType,
  StatusCategory,
  SubscriptionPlan,
  SubscriptionStatus,
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
    ["IssuePriority", ISSUE_PRIORITY_VALUES, IssuePriority],
    ["IssueType", ISSUE_TYPE_VALUES, IssueType],
    ["StatusCategory", STATUS_CATEGORY_VALUES, StatusCategory],
    ["InvitationStatus", INVITATION_STATUS_VALUES, InvitationStatus],
    ["SubscriptionPlan", SUBSCRIPTION_PLAN_VALUES, SubscriptionPlan],
    ["SubscriptionStatus", SUBSCRIPTION_STATUS_VALUES, SubscriptionStatus],
  ] as const)("%s", (_name, shared, prisma) => {
    // Same values in the same order (the web lists categories in this order).
    expect([...shared]).toEqual(Object.values(prisma));
  });
});
