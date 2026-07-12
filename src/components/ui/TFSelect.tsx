"use client";

import {
	cn,
	Description,
	Label,
	ListBox,
	Select,
	type SelectProps,
} from "@heroui/react";

export interface SelectOption {
	label: string;
	value: string;
}

interface TFSelectProps extends Omit<
	SelectProps,
	"children" | "value" | "onChange"
> {
	label?: string;
	value: string;
	options: SelectOption[];
	onChange?: (value: string) => void;
	description?: string;
	className?: string;
}

export function TFSelect({
	value,
	options,
	onChange,
	label,
	description,
	className,
	...props
}: TFSelectProps) {
	const selectedOption = options.find((option) => option.value === value);

	return (
		<Select
			{...props}
			value={value}
			onChange={(key) => {
				if (key != null) {
					onChange?.(String(key));
				}
			}}
		>
			{label && <Label>{label}</Label>}
			<Select.Trigger className={cn(className)}>
				<Select.Value className={cn("text-sm")}>
					{selectedOption?.label ?? "Select"}
				</Select.Value>
				<Select.Indicator />
			</Select.Trigger>
			{description && <Description>{description}</Description>}
			<Select.Popover>
				<ListBox>
					{options.map((option) => (
						<ListBox.Item
							key={option.value}
							id={option.value}
							textValue={option.label}
						>
							{option.label}
							<ListBox.ItemIndicator />
						</ListBox.Item>
					))}
				</ListBox>
			</Select.Popover>
		</Select>
	);
}
