import { cn } from "@heroui/react";

import type { IssueLabelRef } from "../types/label-types";

/**
 * A label as a small pill: a dot in the label's color and its name. The color
 * is user data, so only the dot uses it — the text stays on theme tokens and
 * reads in both themes whatever color was picked.
 */
export function LabelChip({
	label,
	className,
}: {
	label: IssueLabelRef;
	className?: string;
}) {
	return (
		<span
			title={label.name}
			className={cn(
				"inline-flex max-w-32 items-center gap-1 rounded-full border border-border bg-surface px-1.5 py-0.5 text-xs leading-none",
				className,
			)}
		>
			<span
				aria-hidden
				className="size-2 shrink-0 rounded-full"
				style={{ backgroundColor: label.color }}
			/>
			<span className="truncate">{label.name}</span>
		</span>
	);
}

/**
 * An issue's labels in a row, the first `max` as chips and the rest as "+n"
 * (named in its tooltip). Renders nothing when there are none.
 */
export function LabelChips({
	labels,
	max = 3,
	className,
}: {
	labels: IssueLabelRef[] | undefined;
	max?: number;
	className?: string;
}) {
	if (!labels?.length) return null;
	const shown = labels.slice(0, max);
	const hidden = labels.slice(max);

	return (
		<span className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
			{shown.map((label) => (
				<LabelChip key={label.id} label={label} />
			))}
			{hidden.length > 0 && (
				<span
					className="text-xs text-muted"
					title={hidden.map((l) => l.name).join(", ")}
				>
					+{hidden.length}
				</span>
			)}
		</span>
	);
}
