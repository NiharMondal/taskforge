"use client";

import {
	Button,
	Checkbox,
	CheckboxGroup,
	Description,
	Label,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { FormTextField, FormWrapper } from "@/components/form-element";
import type { Permissions } from "@/features/memberships/lib/permissions";

import type { GrantablePermission } from "@taskforge/shared";

import { PERMISSION_GROUPS } from "../constants";
import { roleSchema, type TRoleFormValues } from "../schema/role-schema";

type Props = {
	defaultValues?: TRoleFormValues;
	/** The viewer's permissions: keys they don't hold can't be granted. */
	permissions: Permissions;
	/** A built-in role, or one the viewer may only look at. */
	isReadOnly?: boolean;
	submitLabel: string;
	/** Resolves `false` on failure so the form keeps what was entered. */
	onSubmit?: (values: TRoleFormValues) => Promise<boolean>;
	isSubmitting?: boolean;
	onCancel: () => void;
};

/**
 * A role's name and its permissions, one checkbox per catalog key, grouped
 * by area. Keys the viewer doesn't hold are disabled — the backend refuses a
 * role with more access than its author's.
 */
export default function RoleForm({
	defaultValues,
	permissions,
	isReadOnly = false,
	submitLabel,
	onSubmit,
	isSubmitting = false,
	onCancel,
}: Props) {
	const methods = useForm<TRoleFormValues>({
		resolver: zodResolver(roleSchema),
		defaultValues: defaultValues ?? { name: "", permissions: [] },
	});

	const lacksSome =
		!isReadOnly &&
		PERMISSION_GROUPS.some((group) =>
			group.permissions.some((p) => !permissions.granted.has(p.key)),
		);

	return (
		<FormWrapper
			methods={methods}
			onSubmit={async (values) => {
				await onSubmit?.(values);
			}}
		>
			<FormTextField
				name="name"
				label="Name"
				placeholder="e.g. Triage, Contractor, QA"
				isRequired
				isReadOnly={isReadOnly}
			/>

			<Controller
				name="permissions"
				control={methods.control}
				render={({ field }) => (
					<CheckboxGroup
						aria-label="Permissions"
						value={field.value}
						onChange={(keys) =>
							field.onChange(keys as GrantablePermission[])
						}
						isReadOnly={isReadOnly}
						className="flex max-h-[50vh] flex-col gap-5 overflow-y-auto pr-1"
					>
						{PERMISSION_GROUPS.map((group) => (
							<fieldset key={group.title} className="flex flex-col gap-2">
								<legend className="mb-1 text-sm font-semibold">
									{group.title}
								</legend>
								{group.permissions.map((p) => (
									<Checkbox
										key={p.key}
										value={p.key}
										isDisabled={
											!isReadOnly && !permissions.granted.has(p.key)
										}
									>
										<Checkbox.Control>
											<Checkbox.Indicator />
										</Checkbox.Control>
										<Checkbox.Content>
											<Label>{p.label}</Label>
											<Description>{p.description}</Description>
										</Checkbox.Content>
									</Checkbox>
								))}
							</fieldset>
						))}
					</CheckboxGroup>
				)}
			/>

			{lacksSome && (
				<p className="text-xs text-muted">
					Greyed-out permissions aren’t in your own role, so you can’t grant
					them.
				</p>
			)}

			<div className="mt-2 flex justify-end gap-2">
				<Button type="button" variant="outline" onClick={onCancel}>
					{isReadOnly ? "Close" : "Cancel"}
				</Button>
				{!isReadOnly && (
					<Button type="submit" isDisabled={isSubmitting}>
						{isSubmitting ? "Saving…" : submitLabel}
					</Button>
				)}
			</div>
		</FormWrapper>
	);
}
