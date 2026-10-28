import { z } from "zod";
import type { DateValue } from "@internationalized/date";
export const sprintSchema = z
	.object({
		// Limits mirror the backend's CreateSprintDto / UpdateSprintDto.
		name: z
			.string()
			.min(1, "Name is required")
			.max(100, "Name must be at most 100 characters"),
		goal: z
			.string()
			.max(500, "Goal must be at most 500 characters")
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
