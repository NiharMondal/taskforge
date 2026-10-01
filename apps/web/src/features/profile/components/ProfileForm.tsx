"use client";

import { Button } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import {
	FormImageUpload,
	FormTextField,
	FormWrapper,
} from "@/components/form-element";

import { profileSchema, type TProfileFormValues } from "../schema/profile-schema";

type Props = {
	defaultValues: TProfileFormValues;
	/** Read-only — email is not editable from the profile UI. */
	email: string;
	/**
	 * Returns `false` on failure; on success returns the persisted values
	 * (the backend-promoted url/publicId) to re-seed the form with.
	 */
	onSubmit: (
		values: TProfileFormValues,
	) => Promise<TProfileFormValues | boolean | void>;
	isSubmitting: boolean;
};

/** Initials for the avatar fallback, e.g. "Ada Lovelace" -> "AL". */
function initialsOf(name: string): string {
	return (
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((p) => p[0]?.toUpperCase() ?? "")
			.join("") || "?"
	);
}

export default function ProfileForm({
	defaultValues,
	email,
	onSubmit,
	isSubmitting,
}: Props) {
	const methods = useForm<TProfileFormValues>({
		resolver: zodResolver(profileSchema),
		defaultValues,
	});

	const watchedName = useWatch({ control: methods.control, name: "name" });

	const handleFormSubmit = async (values: TProfileFormValues) => {
		const result = await onSubmit(values);
		if (result === false) return;
		// Re-seed defaults with the persisted (promoted) values so the form stays
		// populated, the publicId is no longer temp, and `isDirty` resets.
		methods.reset(typeof result === "object" ? result : values);
	};

	return (
		<FormWrapper methods={methods} onSubmit={handleFormSubmit}>
			<FormImageUpload
				urlName="avatarUrl"
				publicIdName="avatarPublicId"
				label="Profile photo"
				fallback={initialsOf(watchedName || "")}
				folder="temp/user-avatar"
			/>

			<FormTextField
				name="name"
				label="Name"
				placeholder="Your name"
				isRequired
			/>

			<div className="flex flex-col gap-1">
				<span className="text-sm font-medium text-foreground">Email</span>
				<span className="text-sm text-muted">{email}</span>
				<span className="text-xs text-muted">
					Email can&apos;t be changed.
				</span>
			</div>

			<div className="mt-2 flex justify-end">
				<Button type="submit" isDisabled={isSubmitting}>
					{isSubmitting ? "Saving…" : "Save Changes"}
				</Button>
			</div>
		</FormWrapper>
	);
}
