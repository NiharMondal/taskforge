import { z } from "zod";

export const projectSchema = z.object({
	name: z.string().min(1, "Name is required"),
	description: z.string().nullable().optional(),
});

export type TProjectFormValues = z.infer<typeof projectSchema>;
