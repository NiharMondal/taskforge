import { z } from "zod";

/**
 * Profile edit form. Only `name` and `avatarUrl` are editable (email is fixed).
 * `avatarUrl` holds the Cloudinary `secure_url`; an empty string means "no
 * photo selected" and is stripped before the request.
 */
export const profileSchema = z.object({
	name: z.string().min(1, "Name is required").max(100, "Name is too long"),
	avatarUrl: z.union([z.url(), z.literal("")]).optional(),
	avatarPublicId: z.string().optional(),
});

export type TProfileFormValues = z.infer<typeof profileSchema>;
