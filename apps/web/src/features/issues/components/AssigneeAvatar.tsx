"use client";

import { Tooltip } from "@heroui/react";
import { CircleUserRound } from "lucide-react";

import Avatar from "@/components/ui/avatar";
import { initialsOf } from "@/util/initials";

/**
 * An issue's assignee as a small avatar: their picture, else their initials,
 * else (unassigned) a placeholder icon. The full name, or "Unassigned", shows
 * in a tooltip on hover or keyboard focus.
 */
export default function AssigneeAvatar({
	name,
	avatarUrl,
	isAssigned,
}: {
	/** The assignee's display name; falls back to "Assignee" if unknown. */
	name?: string;
	avatarUrl?: string | null;
	isAssigned: boolean;
}) {
	const label = isAssigned ? (name ?? "Assignee") : "Unassigned";

	return (
		<Tooltip delay={300} closeDelay={0}>
			<Tooltip.Trigger
				aria-label={label}
				className="flex shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
			>
				{isAssigned ? (
					<Avatar
						size="sm"
						customSize
						src={avatarUrl ?? undefined}
						alt={label}
						fallback={initialsOf(name)}
					/>
				) : (
					<CircleUserRound className="size-5 text-muted" aria-hidden />
				)}
			</Tooltip.Trigger>
			<Tooltip.Content>{label}</Tooltip.Content>
		</Tooltip>
	);
}
