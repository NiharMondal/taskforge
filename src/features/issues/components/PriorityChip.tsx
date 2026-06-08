import { Chip } from "@heroui/react";

import { PRIORITY_META } from "../constants";
import type { IssuePriority } from "../types/issue-types";

export default function PriorityChip({ priority }: { priority: IssuePriority }) {
  const meta = PRIORITY_META[priority];
  return (
    <Chip size="sm" variant="soft" color={meta.color}>
      {meta.label}
    </Chip>
  );
}
