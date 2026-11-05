"use client";

import { FieldError, Label, ListBox, Select } from "@heroui/react";
import { Controller, useFormContext } from "react-hook-form";

import type { IssueLabelRef } from "../types/label-types";
import { LabelChips } from "./LabelChip";

type Props = {
	/** Form field holding the selected label ids (`string[]`). */
	name: string;
	/** The workspace's labels to choose from. */
	labels: IssueLabelRef[];
	label?: string;
	placeholder?: string;
	isDisabled?: boolean;
};

/**
 * Multi-select of the workspace's labels for a React Hook Form field. The
 * trigger shows the picked labels as chips; the list shows each color.
 */
export default function FormLabelSelect({
	name,
	labels,
	label = "Labels",
	placeholder = "No labels",
	isDisabled,
}: Props) {
	const { control } = useFormContext();

	return (
		<Controller
			name={name}
			control={control}
			render={({ field, fieldState }) => {
				const ids: string[] = field.value ?? [];
				// Ids the form holds but the list lacks (a label deleted since
				// the issue loaded) aren't shown; the next save drops them.
				const picked = labels.filter((l) => ids.includes(l.id));

				return (
					<Select
						selectionMode="multiple"
						name={field.name}
						value={ids}
						onChange={(keys) => field.onChange(keys.map(String))}
						onBlur={field.onBlur}
						isDisabled={isDisabled}
						isInvalid={!!fieldState.error}
						placeholder={placeholder}
						fullWidth
					>
						<Label>{label}</Label>
						<Select.Trigger>
							<Select.Value>
								{({ isPlaceholder }) =>
									isPlaceholder || picked.length === 0 ? (
										<span className="text-muted">{placeholder}</span>
									) : (
										<LabelChips labels={picked} max={4} />
									)
								}
							</Select.Value>
							<Select.Indicator />
						</Select.Trigger>
						<Select.Popover>
							<ListBox>
								{labels.length === 0 ? (
									<ListBox.Item isDisabled textValue="No labels yet">
										<span className="text-sm text-muted italic">
											No labels yet — create them in Settings → Labels
										</span>
									</ListBox.Item>
								) : (
									labels.map((l) => (
										<ListBox.Item key={l.id} id={l.id} textValue={l.name}>
											<span className="flex items-center gap-2">
												<span
													aria-hidden
													className="size-2.5 shrink-0 rounded-full"
													style={{ backgroundColor: l.color }}
												/>
												{l.name}
											</span>
											<ListBox.ItemIndicator />
										</ListBox.Item>
									))
								)}
							</ListBox>
						</Select.Popover>
						<FieldError>{fieldState.error?.message}</FieldError>
					</Select>
				);
			}}
		/>
	);
}
