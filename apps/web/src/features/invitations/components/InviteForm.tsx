"use client";

import { Button } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormSelect, FormTextField, FormWrapper } from "@/components/form-element";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/features/memberships/constants";

import { inviteSchema, type TInviteFormValues } from "../schema/invitation-schema";

const ROLE_OPTIONS = ASSIGNABLE_ROLES.map((role) => ({
	value: role,
	label: ROLE_LABELS[role],
}));

type Props = {
	onSubmit: (
		values: TInviteFormValues,
	) => Promise<boolean | void> | boolean | void;
	isSubmitting: boolean;
	onSuccess?: () => void;
	onCancel?: () => void;
};

export default function InviteForm({
	onSubmit,
	isSubmitting,
	onSuccess,
	onCancel,
}: Props) {
	const methods = useForm<TInviteFormValues>({
		resolver: zodResolver(inviteSchema),
		defaultValues: { email: "", role: "MEMBER" },
	});

	const handleFormSubmit = async (values: TInviteFormValues) => {
		const success = await onSubmit(values);
		if (success === false) return;
		methods.reset();
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
				name="role"
				label="Role"
				options={ROLE_OPTIONS}
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
