"use client";

import { FormTextField, FormWrapper } from "@/components/form-element";
import { getApiErrorMessage } from "@/lib/api-error";
import { Alert, Button, toast } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import GoogleSignInButton, { AuthDivider } from "./google-sign-in-button";
import PasswordVisibilityToggle from "./password-visibility-toggle";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { resolvePostLoginTarget } from "../lib/callback-url";
import { LoginInput, loginSchema } from "../schemas/auth-schema";

/**
 * Why the user just landed here signed out, by query parameter: set after a
 * password change or account deletion (Settings → Profile) or a reset
 * (`/reset-password`).
 */
const NOTICES = {
	passwordChanged: {
		title: "Password changed",
		description:
			"You were signed out everywhere. Sign in with your new password.",
	},
	passwordReset: {
		title: "Password reset",
		description:
			"You were signed out everywhere. Sign in with your new password.",
	},
	accountDeleted: {
		title: "Account deleted",
		description:
			"Your account and the workspaces only you belonged to are gone. We emailed you a confirmation.",
	},
} as const;

export default function LoginForm() {
	const [showPassword, setShowPassword] = useState(false);
	const router = useRouter();
	const searchParams = useSearchParams();
	const noticeKey = (Object.keys(NOTICES) as (keyof typeof NOTICES)[]).find(
		(key) => searchParams.has(key),
	);
	const notice = noticeKey && NOTICES[noticeKey];
	const methods = useForm<LoginInput>({
		resolver: zodResolver(loginSchema),
	});

	// Carries the address already typed, so it needn't be typed again.
	const typedEmail = useWatch({ control: methods.control, name: "email" });
	const forgotPasswordHref = typedEmail
		? `/forgot-password?${new URLSearchParams({ email: typedEmail })}`
		: "/forgot-password";

	const onSubmit = async (data: LoginInput) => {
		try {
			const res = await signIn("credentials", {
				email: data.email,
				password: data.password,
				redirect: false,
			});
			// With `redirect: false`, a failed sign-in still resolves — `error` is
			// the signal, and `ok` can be true regardless. `code` is only set for
			// the credentials rejection we raise ourselves; anything else (backend
			// down, misconfiguration) is a generic failure, not a success.
			if (res.error) {
				toast.danger(
					res.code === "invalid_credentials"
						? "Invalid Credentials"
						: res.code === "email_unverified"
							? "Confirm your email first: sign up again with this address and we'll email you a link."
							: "Something went wrong. Please try again.",
				);
				return;
			}
			toast.success("Logged in successfully");
			router.push(
				resolvePostLoginTarget(searchParams.get("callbackUrl")),
			);
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Something went wrong"));
		}
	};
	return (
		<>
			{notice && (
				<Alert status="success" className="mb-5">
					<Alert.Indicator />
					<Alert.Content>
						<Alert.Title>{notice.title}</Alert.Title>
						<Alert.Description>{notice.description}</Alert.Description>
					</Alert.Content>
				</Alert>
			)}
			<GoogleSignInButton />
			<AuthDivider />
			<FormWrapper methods={methods} onSubmit={onSubmit}>
				<FormTextField
					isRequired
					name="email"
					label="Email"
					placeholder="you@company.com"
					type="email"
				/>
				<FormTextField
					isRequired
					name="password"
					label="Password"
					type={showPassword ? "text" : "password"}
					ornament={
						<PasswordVisibilityToggle
							isVisible={showPassword}
							onToggle={() => setShowPassword((prev) => !prev)}
						/>
					}
				/>
				<div className="-mt-1 flex justify-end">
					<Link
						href={forgotPasswordHref}
						className="text-sm text-accent hover:underline"
					>
						Forgot password?
					</Link>
				</div>
				<Button
					type="submit"
					variant="primary"
					fullWidth
					className="mt-2"
					isDisabled={methods.formState.isSubmitting}
				>
					{methods.formState.isSubmitting ? "Signing in…" : "Sign in"}
				</Button>
			</FormWrapper>
		</>
	);
}
