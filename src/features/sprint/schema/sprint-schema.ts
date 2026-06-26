import { z } from "zod";
import type { DateValue } from "@internationalized/date";
export const sprintSchema = z
	.object({
		name: z.string().min(1, "Name is required"),
		goal: z.string().nullable().optional(),
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
