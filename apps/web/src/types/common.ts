/**
 * A user as embedded in other records (issue reporter/assignee, member).
 *
 * There is deliberately no `email` here: only some endpoints select it (the
 * profile and the members roster), so it is added by the types that need it.
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
