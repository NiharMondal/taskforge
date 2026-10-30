"use client";

import { Button, toast } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormTextField, FormWrapper } from "@/components/form-element";
import { getApiErrorMessage } from "@/lib/api-error";
import GoogleSignInButton, { AuthDivider } from "./google-sign-in-button";
import PasswordVisibilityToggle from "./password-visibility-toggle";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { register } from "../api/auth-api";
import { rememberPostVerificationTarget } from "../lib/callback-url";
import { registerSchema, type RegisterInput } from "../schemas/auth-schema";
import { CheckEmailNotice } from "./check-email-notice";

/**
 * Sign-up. The backend creates nothing until the emailed link is followed
 * (`/verify-email`), so a successful submit swaps the form for a "check your
 * email" notice instead of signing in.
 */
export function RegisterForm() {
	const [showPassword, setShowPassword] = useState(false);
	/** The address the link went to, once submitted. */
	const [sentTo, setSentTo] = useState<string | null>(null);
	const [isResending, setIsResending] = useState(false);
	const searchParams = useSearchParams();

	const methods = useForm<RegisterInput>({
		resolver: zodResolver(registerSchema),
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
		},
	});

	const onSubmit = async (values: RegisterInput) => {
		try {
			// Only what the backend reads: `confirmPassword` is form-only.
			const res = await register({
				name: values.name,
				email: values.email,
				password: values.password,
			});
			// e.g. back to the invite link that sent them here, once confirmed
			rememberPostVerificationTarget(searchParams.get("callbackUrl"));
			setSentTo(res.data.email);
			return true;
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Couldn't start your sign-up"));
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
				email={sentTo}
				onResend={resend}
				isResending={isResending}
				onChangeEmail={() => setSentTo(null)}
			/>
		);
	}

	return (
		<>
			<GoogleSignInButton />
			<AuthDivider />
			<FormWrapper onSubmit={onSubmit} methods={methods}>
				<FormTextField
					name="name"
					label="Full name"
					placeholder="Ada Lovelace"
				/>

				<FormTextField
					name="email"
					label="Email"
					type="email"
					placeholder="you@company.com"
				/>

				<FormTextField
					name="password"
					label="Password"
					type={showPassword ? "text" : "password"}
					placeholder="At least 8 characters"
					ornament={
						<PasswordVisibilityToggle
							isVisible={showPassword}
							onToggle={() => setShowPassword((prev) => !prev)}
						/>
					}
				/>

				<FormTextField
					name="confirmPassword"
					label="Confirm password"
					type={showPassword ? "text" : "password"}
					placeholder="Re-enter your password"
					ornament={
						<PasswordVisibilityToggle
							isVisible={showPassword}
							onToggle={() => setShowPassword((prev) => !prev)}
						/>
					}
				/>

				<Button
					type="submit"
					variant="primary"
					fullWidth
					className="mt-2"
					isDisabled={methods.formState.isSubmitting}
				>
					{methods.formState.isSubmitting
						? "Creating account…"
						: "Create account"}
				</Button>

				{/* Opens in a new tab so the half-filled form isn't lost. */}
				<p className="text-center text-xs text-muted">
					By creating an account, you agree to the{" "}
					<Link
						href="/terms"
						target="_blank"
						className="text-accent hover:underline"
					>
						Terms of Service
					</Link>{" "}
					and{" "}
					<Link
						href="/privacy"
						target="_blank"
						className="text-accent hover:underline"
					>
						Privacy Policy
					</Link>
					.
				</p>
			</FormWrapper>
		</>
	);
}
