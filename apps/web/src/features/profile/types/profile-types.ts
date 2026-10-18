/**
 * User profile contract types.
 *
 * Mirrors what `GET /users/:id` and `PATCH /users/:id` return: the Prisma `User`
 * row plus `auth: { email }`. The email lives on `Auth`, not `User`, so it is
 * nested (and `null` if the user has no `Auth` row). It is intentionally not
 * part of the update DTO — it is not editable from the UI.
 */
export interface User {
	id: string;
	name: string;
	auth: { email: string } | null;
	avatarUrl: string | null;
	avatarPublicId: string | null;
	createdAt: string;
	updatedAt: string;
}

/**
 * Editable fields for `PATCH /users/:id`. Sending `avatarPublicId` (a temp
 * publicId) tells the backend to promote that upload and persist the resulting
 * permanent `avatarUrl`/`avatarPublicId` (see spec/cloudinary.md).
 */
export interface UpdateProfileDto {
	name?: string;
	avatarUrl?: string;
	avatarPublicId?: string;
}
