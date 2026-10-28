import { IssueStatus } from "generated/prisma/enums";

/**
 * Legal moves out of each status — the workflow is a line (backlog → todo →
 * in progress → in review → qa requested → deployed → done) with two
 * exceptions: QA either passes (DEPLOYED) or fails (QA_FAILED), and a failed
 * issue goes back to IN_PROGRESS. DONE is terminal.
 *
 * Mirrors STATUS_TRANSITIONS in apps/web/src/features/issues/constants.ts,
 * which drives the status Selects and board drops; change both together.
 * Creating an issue may use any status — this governs changes only.
 */
export const STATUS_TRANSITIONS: Record<IssueStatus, readonly IssueStatus[]> = {
  [IssueStatus.BACKLOG]: [IssueStatus.TODO],
  [IssueStatus.TODO]: [IssueStatus.IN_PROGRESS],
  [IssueStatus.IN_PROGRESS]: [IssueStatus.IN_REVIEW],
  [IssueStatus.IN_REVIEW]: [IssueStatus.QA_REQUESTED],
  [IssueStatus.QA_REQUESTED]: [IssueStatus.QA_FAILED, IssueStatus.DEPLOYED],
  [IssueStatus.QA_FAILED]: [IssueStatus.IN_PROGRESS],
  [IssueStatus.DEPLOYED]: [IssueStatus.DONE],
  [IssueStatus.DONE]: [],
};

export const isAllowedTransition = (from: IssueStatus, to: IssueStatus) =>
  from === to || STATUS_TRANSITIONS[from].includes(to);
