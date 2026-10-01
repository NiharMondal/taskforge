import { Chip } from "@heroui/react";

import type { ComponentProps } from "react";

import type { InvitationStatus } from "../types/invitation-types";

type ChipColor = NonNullable<ComponentProps<typeof Chip>["color"]>;

/**
 * Display metadata for the `InvitationStatus` enum. Colors use HeroUI's
 * semantic Chip palette, never raw Tailwind colors (see memory: HeroUI 3
 * tokens).
 */
const STATUS_META: Record<InvitationStatus, { label: string; color: ChipColor }> =
	{
		PENDING: { label: "Pending", color: "warning" },
		ACCEPTED: { label: "Accepted", color: "success" },
		EXPIRED: { label: "Expired", color: "default" },
		REVOKED: { label: "Revoked", color: "danger" },
	};

/** Read-only invitation status pill, mirrors the issues' StatusChip. */
export default function InvitationStatusChip({
	status,
}: {
	status: InvitationStatus;
}) {
	const meta = STATUS_META[status];
	return (
		<Chip size="sm" variant="soft" color={meta.color}>
			{meta.label}
		</Chip>
	);
}
