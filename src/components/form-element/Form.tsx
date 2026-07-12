/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import {
	FormProvider as HookFormProvider,
	UseFormReturn,
} from "react-hook-form";
import { Form as AriaForm, cn } from "@heroui/react";

type Props = {
	methods: UseFormReturn<any>;
	onSubmit: (data: any) => void;
	children: React.ReactNode;
	className?: string;
};

export default function FormWrapper({
	methods,
	onSubmit,
	children,
	className,
}: Props) {
	return (
		<HookFormProvider {...methods}>
			{/*
			 * HeroUI's Form (react-aria) sets validationBehavior="aria" -> the <form>
			 * gets `noValidate`, so native browser validation no longer blocks submit,
			 * and every child field defers validation to React Hook Form (driven by the
			 * `isInvalid` + <FieldError> we pass). Without this, fields with `isRequired`
			 * trigger native validation that silently blocks handleSubmit.
			 */}
			<AriaForm
				onSubmit={methods.handleSubmit(onSubmit)}
				validationBehavior="aria"
				className={cn("space-y-3", className)}
			>
				{children}
			</AriaForm>
		</HookFormProvider>
	);
}
