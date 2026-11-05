import { z } from "zod";

import { GRANTABLE_PERMISSIONS, MAX_ROLE_NAME_LENGTH } from "../constants";

export const roleSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Enter a name")
		.max(MAX_ROLE_NAME_LENGTH, `At most ${MAX_ROLE_NAME_LENGTH} characters`),
	permissions: z.array(z.enum(GRANTABLE_PERMISSIONS)),
});

export type TRoleFormValues = z.infer<typeof roleSchema>;
