export interface ICommonUserEntity {
	id: string;
	name: string;
	email: string;
	avatarUrl?: string;
}

export interface IFormSelectOption {
	value: string;
	label: string;
	description?: string;
}
