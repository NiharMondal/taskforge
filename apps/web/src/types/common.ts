/**
 * A user as embedded in other records (issue reporter/assignee, member).
 *
 * There is deliberately no `email` here: the backend keeps it on `Auth`, not
 * `User`, and only some endpoints expose it (as `auth.email`).
 */
export interface ICommonUserEntity {
	id: string;
	name: string;
	avatarUrl?: string | null;
}

export interface IFormSelectOption {
	value: string | undefined;
	label: string | undefined;
	avatarUrl?: string | undefined;
	description?: string;
}
