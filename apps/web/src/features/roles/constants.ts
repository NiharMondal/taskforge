/**
 * The permission catalog, mirroring `GRANTABLE_PERMISSIONS` in
 * apps/backend/src/common/permissions/permissions.ts — same keys, same order.
 * Change both together: a key missing here can't be granted from the role
 * editor, and one the backend doesn't know is a 400.
 */
export const GRANTABLE_PERMISSIONS = [
	"workspace:manage",
	"project:manage",
	"label:manage",
	"sprint:manage",
	"issue:create",
	"issue:delete",
	"issue:edit:any",
	"issue:edit:own",
	"issue:status",
	"issue:status:done",
	"comment:create",
	"comment:delete:any",
	"member:manage",
	"invitation:manage",
	"role:manage",
] as const;

export type GrantablePermission = (typeof GRANTABLE_PERMISSIONS)[number];

/** Held by the workspace owner alone; no role can be given them. */
export type OwnerOnlyPermission = "workspace:delete" | "workspace:transfer";

export type Permission = GrantablePermission | OwnerOnlyPermission;

export interface PermissionMeta {
	key: GrantablePermission;
	label: string;
	description: string;
}

/** The role editor's sections. Every grantable key appears exactly once. */
export const PERMISSION_GROUPS: { title: string; permissions: PermissionMeta[] }[] = [
	{
		title: "Issues",
		permissions: [
			{
				key: "issue:create",
				label: "Create issues",
				description: "Add issues and sub-issues to any project.",
			},
			{
				key: "issue:edit:own",
				label: "Edit their own issues",
				description:
					"Title, description, priority, type, points, assignee, sprint and labels of issues they reported or are assigned to.",
			},
			{
				key: "issue:edit:any",
				label: "Edit any issue",
				description: "The same fields, on every issue.",
			},
			{
				key: "issue:status",
				label: "Move issues",
				description: "Change status and board position, except to Done.",
			},
			{
				key: "issue:status:done",
				label: "Mark issues Done",
				description: "Set an issue's status to Done.",
			},
			{
				key: "issue:delete",
				label: "Delete issues",
				description: "Delete any issue, with its sub-issues and comments.",
			},
		],
	},
	{
		title: "Comments",
		permissions: [
			{
				key: "comment:create",
				label: "Comment",
				description: "Comment on issues, and edit or delete their own comments.",
			},
			{
				key: "comment:delete:any",
				label: "Moderate comments",
				description: "Delete anyone's comment.",
			},
		],
	},
	{
		title: "Projects and planning",
		permissions: [
			{
				key: "project:manage",
				label: "Manage projects",
				description: "Create, edit and delete projects.",
			},
			{
				key: "sprint:manage",
				label: "Manage sprints",
				description: "Create, edit, start and complete sprints.",
			},
			{
				key: "label:manage",
				label: "Manage labels",
				description: "Create, rename, recolor and delete labels.",
			},
		],
	},
	{
		title: "Workspace",
		permissions: [
			{
				key: "workspace:manage",
				label: "Edit workspace details",
				description: "Rename the workspace and edit its description.",
			},
			{
				key: "member:manage",
				label: "Manage members",
				description: "Change members' roles and remove members.",
			},
			{
				key: "invitation:manage",
				label: "Manage invitations",
				description: "Send, list and revoke invitations.",
			},
			{
				key: "role:manage",
				label: "Manage roles",
				description: "Create, edit and delete custom roles.",
			},
		],
	},
];

export const MAX_ROLE_NAME_LENGTH = 50;
