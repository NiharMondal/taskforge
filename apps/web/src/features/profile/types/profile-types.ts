/**
 * User profile contract types.
 *
 * Mirrors what `GET /users/:id` and `PATCH /users/:id` return: the Prisma `User`
 * row. `email` is intentionally not part of the update DTO — it is not editable
 * from the UI.
 */
export interface User {
	id: string;
	name: string;
	email: string;
	avatarUrl: string | null;
	avatarPublicId: string | null;
	emailVerifiedAt: string | null;
	createdAt: string;
	updatedAt: string;
	/**
	 * Whether the account has a password (an EMAIL sign-in method); `false` for
	 * Google-only accounts. Only `GET /users/me` (and `/users/:id`) include it.
	 */
	hasPassword?: boolean;
}

/**
 * `DELETE /users/me`: an account with a password confirms with it; a
 * Google-only one (`hasPassword: false`) with its email.
 */
export type DeleteAccountDto = { password: string } | { confirmEmail: string };

/**
 * Editable fields for `PATCH /users/:id`. Sending `avatarPublicId` (a temp
 * publicId) tells the backend to promote that upload and persist the resulting
 * permanent `avatarUrl`/`avatarPublicId` (see spec/cloudinary.md).
 */
export interface UpdateProfileDto {
	name?: string;
	avatarUrl?: string;
	/** `null` removes the avatar (the backend also deletes the stored image). */
	avatarPublicId?: string | null;
}
