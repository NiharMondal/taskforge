export interface Sprint {
	id: string;
	name: string;
	goal?: string | null;
	startDate?: string | null;
	endDate?: string | null;
	isActive: boolean;
	/** Set once the sprint is ended; the backend refuses to start it again. */
	completedAt?: string | null;
	projectId: string;
	workspaceId: string;
	createdAt: string;
}

export interface CreateSprintDto {
	name: string;
	goal?: string | null;
	startDate?: string | null;
	endDate?: string | null;
}

export type UpdateSprintDto = Partial<CreateSprintDto>;
