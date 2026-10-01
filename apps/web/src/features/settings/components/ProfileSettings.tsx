"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Spinner,
	toast,
} from "@heroui/react";
import { useSession } from "next-auth/react";

import ProfileForm from "@/features/profile/components/ProfileForm";
import { useCurrentUser, useUpdateProfile } from "@/features/profile/hooks/use-profile";
import type { TProfileFormValues } from "@/features/profile/schema/profile-schema";
import type { UpdateProfileDto } from "@/features/profile/types/profile-types";
import { getApiErrorMessage } from "@/lib/api-error";
import { isTempPublicId } from "@/lib/cloudinary";

/**
 * Settings → Profile. Lets the signed-in user update their display name and
 * avatar (`PATCH /users/:id`). Email is shown read-only. On save we also push
 * the new name/image into the Auth.js session via `update()` so the header
 * reflects the change without a re-login.
 */
export default function ProfileSettings() {
	const { data: session, update } = useSession();
	const userId = session?.user?.id;

	const { data: user, isLoading } = useCurrentUser(userId);
	const { mutateAsync: updateProfile, isPending } = useUpdateProfile();

	const handleSubmit = async (values: TProfileFormValues) => {
		if (!userId) return false;

		const dto: UpdateProfileDto = { name: values.name };
		// Only send avatar fields for a fresh (temp) upload — the backend
		// promotes it and returns the permanent url/publicId. An unchanged
		// (already-permanent) avatar needs no promotion and is left untouched.
		if (isTempPublicId(values.avatarPublicId)) {
			dto.avatarUrl = values.avatarUrl;
			dto.avatarPublicId = values.avatarPublicId;
		}

		try {
			const res = await updateProfile({ userId, dto });
			if (res.success) {
				await update({
					name: res.data.name,
					image: res.data.avatarUrl || null,
				});
				toast.success(res.message || "Profile updated");
				// Re-seed the form with the persisted (promoted) values so the
				// uploader no longer holds a temp publicId.
				return {
					name: res.data.name,
					avatarUrl: res.data.avatarUrl ?? "",
					avatarPublicId: res.data.avatarPublicId ?? "",
				};
			}
			return true;
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Failed to update profile"));
			return false;
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Your profile</CardTitle>
				<CardDescription>
					Update your name and profile photo.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{isLoading || !user ? (
					<div className="flex items-center justify-center py-8">
						<Spinner />
					</div>
				) : (
					<ProfileForm
						key={user.id}
						defaultValues={{
							name: user.name,
							avatarUrl: user.avatarUrl ?? "",
							avatarPublicId: user.avatarPublicId ?? "",
						}}
						email={user.email}
						onSubmit={handleSubmit}
						isSubmitting={isPending}
					/>
				)}
			</CardContent>
		</Card>
	);
}
