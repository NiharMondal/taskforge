import { Chip } from "@heroui/react";

import { ROLE_COLOR, ROLE_LABELS } from "@/features/memberships/constants";
import type { WorkspaceRole } from "@/features/workspace/types/workspace-types";

import type { RoleSummary } from "../types/role-types";

/**
 * A role's name as a chip: built-ins in their colors, custom roles plain.
 * `fallback` is the legacy enum, for rows predating roles (no `role`).
 */
export function RoleChip({
	role,
	fallback,
}: {
	role: Pick<RoleSummary, "name" | "systemKey"> | null | undefined;
	fallback?: WorkspaceRole;
}) {
	const systemKey = role ? role.systemKey : fallback;
	const name = role?.name ?? (fallback ? ROLE_LABELS[fallback] : "—");

	return (
		<Chip
			size="sm"
			variant="soft"
			color={systemKey ? ROLE_COLOR[systemKey] : "default"}
			className="max-w-40"
		>
			<span className="truncate">{name}</span>
		</Chip>
	);
}
