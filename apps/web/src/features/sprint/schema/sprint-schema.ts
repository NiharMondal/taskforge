import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH } from "@taskforge/shared";
import { z } from "zod";
import type { DateValue } from "@internationalized/date";
export const sprintSchema = z
	.object({
		// Limits are the backend's CreateSprintDto / UpdateSprintDto ones.
		name: z
			.string()
			.min(1, "Name is required")
			.max(MAX_NAME_LENGTH, `Name must be at most ${MAX_NAME_LENGTH} characters`),
		goal: z
			.string()
			.max(
				MAX_DESCRIPTION_LENGTH,
				`Goal must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
			)
			.nullable()
			.optional(),
		startDate: z.custom<DateValue>().nullable().optional(),
		endDate: z.custom<DateValue>().nullable().optional(),
	})
	.refine(
		(data) => {
			if (data.startDate && data.endDate) {
				return data.endDate.compare(data.startDate) >= 0;
			}
			return true;
		},
		{
			message: "End date must be on or after start date",
			path: ["endDate"],
		},
	);

export type TSprintFormValues = z.infer<typeof sprintSchema>;
