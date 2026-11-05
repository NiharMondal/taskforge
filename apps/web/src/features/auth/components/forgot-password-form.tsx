"use client";

import { Button, toast } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormTextField, FormWrapper } from "@/components/form-element";
import { getApiErrorMessage } from "@/lib/api-error";
import { forgotPassword } from "../api/auth-api";
import {
	forgotPasswordSchema,
	type ForgotPasswordInput,
} from "../schemas/auth-schema";
import { CheckEmailNotice } from "./check-email-notice";

/**
 * "Forgot password": asks for the address and swaps the form for a "check
 * your email" notice. The backend answers the same whether or not the address
 * has an account, so the notice doesn't claim one. `?email=` prefills it.
 */
export function ForgotPasswordForm() {
	const searchParams = useSearchParams();
	/** The address the link went to, once submitted. */
	const [sentTo, setSentTo] = useState<string | null>(null);
	const [isResending, setIsResending] = useState(false);

	const methods = useForm<ForgotPasswordInput>({
		resolver: zodResolver(forgotPasswordSchema),
		defaultValues: { email: searchParams.get("email") ?? "" },
	});

	const onSubmit = async (values: ForgotPasswordInput) => {
		try {
			await forgotPassword({ email: values.email });
			setSentTo(values.email);
			return true;
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Couldn't send the link"));
			return false;
		}
	};

	const resend = async () => {
		setIsResending(true);
		const sent = await onSubmit(methods.getValues());
		setIsResending(false);
		if (sent) toast.success("We sent another link");
	};

	if (sentTo) {
		return (
			<CheckEmailNotice
				variant="password-reset"
				email={sentTo}
				onResend={resend}
				isResending={isResending}
				onChangeEmail={() => setSentTo(null)}
			/>
		);
	}

	return (
		<FormWrapper methods={methods} onSubmit={onSubmit}>
			<FormTextField
				isRequired
				name="email"
				label="Email"
				type="email"
				placeholder="you@company.com"
			/>
			<Button
				type="submit"
				variant="primary"
				fullWidth
				className="mt-2"
				isDisabled={methods.formState.isSubmitting}
			>
				{methods.formState.isSubmitting ? "Sending…" : "Send reset link"}
			</Button>
		</FormWrapper>
	);
}
