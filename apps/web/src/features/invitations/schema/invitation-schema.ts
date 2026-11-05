import { z } from "zod";

export const inviteSchema = z.object({
	email: z.email("Enter a valid email address"),
	// Any role but the owner's, custom ones included; the backend refuses one
	// with more access than the inviter's.
	roleId: z.string().min(1, "Choose a role"),
});

export type TInviteFormValues = z.infer<typeof inviteSchema>;
