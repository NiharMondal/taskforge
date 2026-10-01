import { Chip } from "@heroui/react";

import { STATUS_META } from "../constants";
import type { IssueStatus } from "../types/issue-types";

/** Read-only status pill. The interactive variant lives in {@link IssueRow}. */
export default function StatusChip({ status }: { status: IssueStatus }) {
  const meta = STATUS_META[status];
  return (
    <Chip size="sm" variant="soft" color={meta.color}>
      {meta.label}
    </Chip>
  );
}
