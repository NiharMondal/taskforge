import type { ComponentProps } from "react";

import type { Chip } from "@heroui/react";

import type { WorkspaceRole } from "@/features/workspace/types/workspace-types";

type ChipColor = NonNullable<ComponentProps<typeof Chip>["color"]>;

/** Chip color per built-in role — semantic tokens only (see globals.css). Custom roles are plain. */
export const ROLE_COLOR: Record<WorkspaceRole, ChipColor> = {
	OWNER: "accent",
	ADMIN: "warning",
	MEMBER: "default",
	VIEWER: "default",
};

/**
 * Built-in role labels, for rows that predate roles (no `assignedRole`).
 * Everything else shows the role's own name.
 */
export const ROLE_LABELS: Record<WorkspaceRole, string> = {
	OWNER: "Owner",
	ADMIN: "Admin",
	MEMBER: "Member",
	VIEWER: "Viewer",
};
