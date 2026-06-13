import { z } from "zod";

export const inviteSchema = z.object({
	email: z.email("Enter a valid email address"),
});

export type TInviteFormValues = z.infer<typeof inviteSchema>;
