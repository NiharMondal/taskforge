/**
 * A workspace label, as `/labels` returns it (apps/backend/src/modules/labels/).
 * Issues embed the short form ({@link IssueLabelRef}).
 */
export interface Label {
	id: string;
	name: string;
	/** Hex, e.g. `#22c55e`. User data, so it's styled inline, not by token. */
	color: string;
	workspaceId: string;
	/** `GET /labels` only: how many issues carry it. */
	_count?: { issues: number };
}

/** A label as embedded in an issue (list and detail routes), alphabetical. */
export type IssueLabelRef = Pick<Label, "id" | "name" | "color">;

export interface CreateLabelDto {
	name: string;
	color: string;
}

export type UpdateLabelDto = Partial<CreateLabelDto>;
