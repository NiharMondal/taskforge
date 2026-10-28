import { z } from "zod";

import { ASSIGNABLE_ROLES } from "@/features/memberships/constants";

export const inviteSchema = z.object({
	email: z.email("Enter a valid email address"),
	// OWNER is never invitable; the backend 400s it too.
	role: z.enum(ASSIGNABLE_ROLES, "Choose a role"),
});

export type TInviteFormValues = z.infer<typeof inviteSchema>;
