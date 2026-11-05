"use client";

import { Button, toast } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { MIN_PASSWORD_LENGTH } from "@taskforge/shared";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormTextField, FormWrapper } from "@/components/form-element";
import { ApiError, getApiErrorMessage } from "@/lib/api-error";
import { resetPassword } from "../api/auth-api";
import {
	resetPasswordSchema,
	type ResetPasswordInput,
} from "../schemas/auth-schema";
import PasswordVisibilityToggle from "./password-visibility-toggle";

const INVALID_LINK =
	"This link is invalid, has expired or was already used. Ask for a new one.";

/**
 * Where the link in a reset email lands (`?token=…`): choose a new password.
 * The backend ends every session and doesn't sign in, so on success we sign
 * out (harmless when nobody is signed in) and land on `/login`, which says
 * why. A bad link swaps the form for a way to ask for a new one.
 */
export function ResetPasswordForm() {
	const token = useSearchParams().get("token");
	const [showPassword, setShowPassword] = useState(false);
	const [linkError, setLinkError] = useState<string | null>(
		token ? null : INVALID_LINK,
	);

	const methods = useForm<ResetPasswordInput>({
		resolver: zodResolver(resetPasswordSchema),
		defaultValues: { password: "", confirmPassword: "" },
	});

	const onSubmit = async (values: ResetPasswordInput) => {
		if (!token) return;
		try {
			// Only what the backend reads: `confirmPassword` is form-only.
			await resetPassword({ token, password: values.password });
			await signOut({ redirectTo: "/login?passwordReset=1" });
		} catch (error) {
			// A 400 here is the link (the form already checked the password).
			if (error instanceof ApiError && error.status === 400) {
				setLinkError(INVALID_LINK);
				return;
			}
			toast.danger(getApiErrorMessage(error, "Couldn't reset your password"));
		}
	};

	if (linkError) {
		return (
			<div className="flex flex-col items-center gap-4 text-center">
				<p className="text-sm text-danger" role="alert">
					{linkError}
				</p>
				<div className="flex gap-4 text-sm">
					<Link
						href="/forgot-password"
						className="font-medium text-accent hover:underline"
					>
						Get a new link
					</Link>
					<Link
						href="/login"
						className="font-medium text-accent hover:underline"
					>
						Sign in
					</Link>
				</div>
			</div>
		);
	}

	const toggle = (
		<PasswordVisibilityToggle
			isVisible={showPassword}
			onToggle={() => setShowPassword((prev) => !prev)}
		/>
	);
	const type = showPassword ? "text" : "password";

	return (
		<FormWrapper methods={methods} onSubmit={onSubmit}>
			<FormTextField
				isRequired
				name="password"
				label="New password"
				type={type}
				placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
				ornament={toggle}
			/>
			<FormTextField
				isRequired
				name="confirmPassword"
				label="Confirm new password"
				type={type}
				ornament={toggle}
			/>
			<Button
				type="submit"
				variant="primary"
				fullWidth
				className="mt-2"
				isDisabled={methods.formState.isSubmitting}
			>
				{methods.formState.isSubmitting ? "Saving…" : "Set new password"}
			</Button>
		</FormWrapper>
	);
}
