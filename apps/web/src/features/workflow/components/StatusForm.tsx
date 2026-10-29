"use client";

import { Button, cn, Label } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";

import {
	FormSelect,
	FormTextField,
	FormWrapper,
} from "@/components/form-element";
import StatusChip from "@/features/issues/components/StatusChip";
import { LABEL_COLORS } from "@/features/labels/constants";

import { STATUS_CATEGORIES } from "../lib/workflow";
import { statusSchema, type TStatusFormValues } from "../schema/status-schema";

type Props = {
	/** The status being edited; omit to add one. */
	defaultValues?: TStatusFormValues;
	/** Resolves `false` on failure so the form keeps what was entered. */
	onSubmit: (values: TStatusFormValues) => Promise<boolean>;
	isSubmitting: boolean;
	onCancel: () => void;
};

/** Name, color swatches, category, and a live preview of the chip. */
export default function StatusForm({
	defaultValues,
	onSubmit,
	isSubmitting,
	onCancel,
}: Props) {
	const isEditing = !!defaultValues;
	const methods = useForm<TStatusFormValues>({
		resolver: zodResolver(statusSchema),
		defaultValues: defaultValues ?? {
			name: "",
			color: LABEL_COLORS[5].value,
			category: "STARTED",
		},
	});
	const [name, color, category] = useWatch({
		control: methods.control,
		name: ["name", "color", "category"],
	});

	return (
		<FormWrapper methods={methods} onSubmit={onSubmit}>
			<FormTextField
				name="name"
				label="Name"
				placeholder="e.g. QA, Design review, Blocked"
				isRequired
			/>

			<FormSelect
				name="category"
				label="Category"
				options={STATUS_CATEGORIES.map((c) => ({
					value: c.value,
					label: c.label,
				}))}
			/>
			<p className="-mt-2 text-xs text-muted">
				{STATUS_CATEGORIES.find((c) => c.value === category)?.description}
			</p>

			<Controller
				name="color"
				control={methods.control}
				render={({ field }) => (
					<div className="flex flex-col gap-2">
						<Label id="status-color">Color</Label>
						<div
							role="radiogroup"
							aria-labelledby="status-color"
							className="flex flex-wrap gap-2"
						>
							{LABEL_COLORS.map((c) => {
								const isOn = field.value === c.value;
								return (
									<button
										key={c.value}
										type="button"
										role="radio"
										aria-checked={isOn}
										aria-label={c.name}
										title={c.name}
										onClick={() => field.onChange(c.value)}
										className={cn(
											"flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow",
											isOn
												? "ring-2 ring-foreground"
												: "hover:ring-2 hover:ring-border",
										)}
										style={{ backgroundColor: c.value }}
									>
										{isOn && <Check className="size-4 text-white" />}
									</button>
								);
							})}
						</div>
					</div>
				)}
			/>

			<div className="flex items-center gap-2 text-sm text-muted">
				Preview
				<StatusChip status={{ name: name?.trim() || "Status", color }} />
			</div>

			<div className="mt-2 flex justify-end gap-2">
				<Button type="button" variant="outline" onClick={onCancel}>
					Cancel
				</Button>
				<Button type="submit" isDisabled={isSubmitting}>
					{isSubmitting
						? "Saving…"
						: isEditing
							? "Save changes"
							: "Add status"}
				</Button>
			</div>
		</FormWrapper>
	);
}
