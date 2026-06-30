/**
 * User profile contract types.
 *
 * Mirrors the backend `SafeUser` (Prisma `User` minus `passwordHash`) returned
 * by `GET /users/:id` and `PATCH /users/:id`. Email is intentionally not part
 * of the update DTO — it is not editable from the UI.
 */
export interface User {
	id: string;
	name: string;
	email: string;
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
