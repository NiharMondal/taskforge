"use client";

import { FormTextField, FormWrapper } from "@/components/form-element";
import { getApiErrorMessage } from "@/lib/api-error";
import { Button, toast } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import GoogleSignInButton, { AuthDivider } from "./google-sign-in-button";
import PasswordVisibilityToggle from "./password-visibility-toggle";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { resolvePostLoginTarget } from "../lib/callback-url";
import { LoginInput, loginSchema } from "../schemas/auth-schema";

export default function LoginForm() {
	const [showPassword, setShowPassword] = useState(false);
	const router = useRouter();
	const searchParams = useSearchParams();
	const methods = useForm<LoginInput>({
		resolver: zodResolver(loginSchema),
	});

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
