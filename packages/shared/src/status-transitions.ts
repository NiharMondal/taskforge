import type { IssueStatus } from "./enums";

/**
 * Legal moves out of each status — the workflow is a line (backlog → todo →
 * in progress → in review → qa requested → deployed → done) with two
 * exceptions: QA either passes (DEPLOYED) or fails (QA_FAILED), and a failed
 * issue goes back to IN_PROGRESS. DONE is terminal.
 *
 * The backend refuses any other change on PATCH; the web offers only these in
 * the status Selects and board drops. Creating an issue may use any status —
 * this governs changes only.
 */
export const STATUS_TRANSITIONS: Record<IssueStatus, readonly IssueStatus[]> = {
  BACKLOG: ["TODO"],
  TODO: ["IN_PROGRESS"],
  IN_PROGRESS: ["IN_REVIEW"],
  IN_REVIEW: ["QA_REQUESTED"],
  QA_REQUESTED: ["QA_FAILED", "DEPLOYED"],
  QA_FAILED: ["IN_PROGRESS"],
  DEPLOYED: ["DONE"],
  DONE: [],
};

/** Whether an issue may move from `from` to `to` (staying put always may). */
export const isAllowedTransition = (from: IssueStatus, to: IssueStatus) =>
  from === to || STATUS_TRANSITIONS[from].includes(to);
