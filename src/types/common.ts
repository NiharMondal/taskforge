export interface ICommonUserEntity {
	id: string;
	name: string;
	email: string;
	avatarUrl?: string;
}

export interface IFormSelectOption {
	value: string | undefined;
	label: string | undefined;
	url?: string | undefined;
	description?: string;
}
