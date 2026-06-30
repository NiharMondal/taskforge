import type { ComponentProps } from "react";

import type { Chip } from "@heroui/react";

import type { WorkspaceRole } from "@/features/workspace/types/workspace-types";

type ChipColor = NonNullable<ComponentProps<typeof Chip>["color"]>;

/** Chip color per role — semantic tokens only (see globals.css). */
export const ROLE_COLOR: Record<WorkspaceRole, ChipColor> = {
	OWNER: "accent",
	ADMIN: "warning",
	MEMBER: "default",
	VIEWER: "default",
};

/** Human-friendly role labels for selects and chips. */
export const ROLE_LABELS: Record<WorkspaceRole, string> = {
	OWNER: "Owner",
	ADMIN: "Admin",
	MEMBER: "Member",
	VIEWER: "Viewer",
};

/**
 * Roles that can be assigned through the settings UI. OWNER is intentionally
 * excluded: transferring ownership is a distinct, higher-stakes action and not
 * something we expose as a casual dropdown change.
 */
export const ASSIGNABLE_ROLES: Exclude<WorkspaceRole, "OWNER">[] = [
	"ADMIN",
	"MEMBER",
	"VIEWER",
];
