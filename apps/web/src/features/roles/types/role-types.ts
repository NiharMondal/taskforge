import type { WorkspaceRole } from "@/features/workspace/types/workspace-types";

import type { GrantablePermission } from "@taskforge/shared";

/**
 * A workspace role, as `GET /roles` returns it
 * (apps/backend/src/modules/roles/role.service.ts). Built-ins carry a
 * `systemKey` and are read-only; custom roles have none. The owner's
 * `permissions` is the whole catalog (it holds everything in code).
 */
export interface Role {
	id: string;
	name: string;
	systemKey: WorkspaceRole | null;
	permissions: GrantablePermission[];
	/** Members holding it. */
	memberCount: number;
	createdAt: string;
	updatedAt: string;
}

/** `POST /roles` body. */
export interface CreateRoleDto {
	name: string;
	permissions: GrantablePermission[];
}

/** `PATCH /roles/:roleId` body; `permissions` replaces the whole set. */
export type UpdateRoleDto = Partial<CreateRoleDto>;

/** The role a roster row or invitation embeds. */
export interface RoleSummary {
	id: string;
	name: string;
	systemKey: WorkspaceRole | null;
}
