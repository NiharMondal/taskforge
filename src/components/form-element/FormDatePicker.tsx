"use client";

import { Controller, useFormContext } from "react-hook-form";
import {
	DatePicker,
	DateField,
	Calendar,
	Label,
	FieldError,
} from "@heroui/react";
import type { DateValue } from "@internationalized/date";

type Props = {
	name: string;
	label?: string;
	isRequired?: boolean;
};

export default function FormDatePicker({ name, label, isRequired }: Props) {
	const { control } = useFormContext();

	return (
		<Controller
			name={name}
			control={control}
			render={({ field, fieldState }) => (
				<DatePicker
					value={(field.value as DateValue) || null}
					onChange={field.onChange}
					isInvalid={!!fieldState.error}
					isRequired={isRequired}
					aria-label={!label ? name : undefined}
					className="w-full"
				>
					{label && <Label>{label}</Label>}

					{/* Input UI */}
					<DateField.Group>
						<DateField.Input>
							{(segment) => (
								<DateField.Segment segment={segment} />
							)}
						</DateField.Input>

						<DateField.Suffix>
							<DatePicker.Trigger>
								<DatePicker.TriggerIndicator />
							</DatePicker.Trigger>
						</DateField.Suffix>
					</DateField.Group>

					{/* Calendar Popover */}
					<DatePicker.Popover>
						<Calendar aria-label="Select date">
							<Calendar.Header>
								<Calendar.YearPickerTrigger>
									<Calendar.YearPickerTriggerHeading />
									<Calendar.YearPickerTriggerIndicator />
								</Calendar.YearPickerTrigger>

								<Calendar.NavButton slot="previous" />
								<Calendar.NavButton slot="next" />
							</Calendar.Header>

							<Calendar.Grid>
								<Calendar.GridHeader>
									{(day) => (
										<Calendar.HeaderCell>
											{day}
										</Calendar.HeaderCell>
									)}
								</Calendar.GridHeader>

								<Calendar.GridBody>
									{(date) => <Calendar.Cell date={date} />}
								</Calendar.GridBody>
							</Calendar.Grid>

							<Calendar.YearPickerGrid>
								<Calendar.YearPickerGridBody>
									{({ year }) => (
										<Calendar.YearPickerCell year={year} />
									)}
								</Calendar.YearPickerGridBody>
							</Calendar.YearPickerGrid>
						</Calendar>
					</DatePicker.Popover>

					<FieldError>{fieldState.error?.message}</FieldError>
				</DatePicker>
			)}
		/>
	);
}
