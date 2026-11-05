"use client";

import { Button, cn, Label } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { FormTextField, FormWrapper } from "@/components/form-element";

import { DEFAULT_LABEL_COLOR, LABEL_COLORS } from "../constants";
import { labelSchema, type TLabelFormValues } from "../schema/label-schema";
import { LabelChip } from "./LabelChip";

type Props = {
	/** The label being edited; omit to create one. */
	defaultValues?: TLabelFormValues;
	/** Resolves `false` on failure so the form keeps what was entered. */
	onSubmit: (values: TLabelFormValues) => Promise<boolean>;
	isSubmitting: boolean;
	onCancel: () => void;
};

/** Name, color swatches and a live preview of the chip. */
export default function LabelForm({
	defaultValues,
	onSubmit,
	isSubmitting,
	onCancel,
}: Props) {
	const isEditing = !!defaultValues;
	const methods = useForm<TLabelFormValues>({
		resolver: zodResolver(labelSchema),
		defaultValues: defaultValues ?? { name: "", color: DEFAULT_LABEL_COLOR },
	});
	const [name, color] = useWatch({
		control: methods.control,
		name: ["name", "color"],
	});

	return (
		<FormWrapper methods={methods} onSubmit={onSubmit}>
			<FormTextField
				name="name"
				label="Name"
				placeholder="e.g. Bug, Frontend, Needs design"
				isRequired
			/>

			<Controller
				name="color"
				control={methods.control}
				render={({ field }) => (
					<div className="flex flex-col gap-2">
						<Label id="label-color">Color</Label>
						<div
							role="radiogroup"
							aria-labelledby="label-color"
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
											isOn ? "ring-2 ring-foreground" : "hover:ring-2 hover:ring-border",
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
				<LabelChip
					label={{ id: "preview", name: name?.trim() || "Label", color }}
				/>
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
							: "Create label"}
				</Button>
			</div>
		</FormWrapper>
	);
}
