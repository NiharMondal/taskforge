"use client";

import { Button } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormSelect, FormTextField, FormWrapper } from "@/components/form-element";
import type { Role } from "@/features/roles/types/role-types";

import { inviteSchema, type TInviteFormValues } from "../schema/invitation-schema";

type Props = {
	/** The roles the inviter may hand out (see `InviteMemberButton`). */
	roles: Role[];
	onSubmit: (
		values: TInviteFormValues,
	) => Promise<boolean | void> | boolean | void;
	isSubmitting: boolean;
	onSuccess?: () => void;
	onCancel?: () => void;
};

export default function InviteForm({
	roles,
	onSubmit,
	isSubmitting,
	onSuccess,
	onCancel,
}: Props) {
	// Member by default, as before roles could be custom.
	const defaultRoleId =
		(roles.find((r) => r.systemKey === "MEMBER") ?? roles[0])?.id ?? "";
	const methods = useForm<TInviteFormValues>({
		resolver: zodResolver(inviteSchema),
		defaultValues: { email: "", roleId: defaultRoleId },
	});

	const handleFormSubmit = async (values: TInviteFormValues) => {
		const success = await onSubmit(values);
		if (success === false) return;
		methods.reset({ email: "", roleId: defaultRoleId });
		onSuccess?.();
	};

	return (
		<FormWrapper methods={methods} onSubmit={handleFormSubmit}>
			<FormTextField
				name="email"
				label="Email"
				placeholder="teammate@company.com"
				type="email"
				isRequired
			/>

			<FormSelect
				name="roleId"
				label="Role"
				options={roles.map((r) => ({ value: r.id, label: r.name }))}
				isRequired
			/>

			<div className="mt-2 flex justify-end gap-2">
				{onCancel && (
					<Button variant="outline" type="button" onClick={onCancel}>
						Cancel
					</Button>
				)}
				<Button type="submit" isDisabled={isSubmitting}>
					{isSubmitting ? "Sending…" : "Send Invitation"}
				</Button>
			</div>
		</FormWrapper>
	);
}
