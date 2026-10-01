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
import { toCalendarDate } from "@/util/format-date";
type minMaxDate = DateValue | Date | string | number | null | undefined;
type Props = {
	name: string;
	label?: string;
	isRequired?: boolean;
	/** Prevent selecting any date before today. */
	disablePastDate?: boolean;
	/** Prevent selecting any date after today. */
	disableFutureDate?: boolean;
	/** Custom lower bound (ignored when `disablePastDate` is set). */
	minDate?: minMaxDate;
	/** Custom upper bound (ignored when `disableFutureDate` is set). */
	maxDate?: minMaxDate;
};

/** A form-held `DateValue` is passed through; JS dates/strings are converted. */
const resolveBound = (value?: minMaxDate): DateValue | undefined => {
	if (value == null) return undefined;
	if (typeof value === "object" && "calendar" in value) return value;
	return toCalendarDate(value);
};

export default function FormDatePicker({
	name,
	label,
	isRequired,
	disablePastDate,
	disableFutureDate,
	minDate,
	maxDate,
}: Props) {
	const { control } = useFormContext();

	const minValue = disablePastDate
		? toCalendarDate(new Date())
		: resolveBound(minDate);

	const maxValue = disableFutureDate
		? toCalendarDate(new Date())
		: resolveBound(maxDate);

	return (
		<Controller
			name={name}
			control={control}
			render={({ field, fieldState }) => (
				<DatePicker
					value={(field.value as DateValue) || null}
					onChange={field.onChange}
					minValue={minValue}
					maxValue={maxValue}
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
						<Calendar
							aria-label="Select date"
							minValue={minValue}
							maxValue={maxValue}
						>
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
