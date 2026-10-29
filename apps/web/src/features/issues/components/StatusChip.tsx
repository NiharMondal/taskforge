import { cn } from "@heroui/react";

import type { IssueStatusRef } from "../types/issue-types";

/**
 * Read-only status pill: a dot in the status's color and its name. Like a
 * label, the color is the project's choice, so only the dot uses it and the
 * text stays on theme tokens. The interactive variant is `IssueStatusSelect`.
 */
export default function StatusChip({
  status,
  className,
}: {
  status: Pick<IssueStatusRef, "name" | "color">;
  className?: string;
}) {
  return (
    <span
      title={status.name}
      className={cn(
        "inline-flex max-w-40 items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5 text-xs leading-tight",
        className,
      )}
    >
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: status.color }}
      />
      <span className="truncate">{status.name}</span>
    </span>
  );
}
