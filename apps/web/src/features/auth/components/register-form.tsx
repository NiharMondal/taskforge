"use client";

import { Button, toast } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormTextField, FormWrapper } from "@/components/form-element";
import { signIn } from "next-auth/react";
import PasswordVisibilityToggle from "./password-visibility-toggle";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { register } from "../api/auth-api";
import { resolvePostLoginTarget } from "../lib/callback-url";
import { registerSchema, type RegisterInput } from "../schemas/auth-schema";

export function RegisterForm() {
	const [showPassword, setShowPassword] = useState(false);
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
			if (res.success) {
				await signIn("credentials", {
					email: values.email,
					password: values.password,
					redirect: true,
					// e.g. back to the invite link that sent them here
					redirectTo: resolvePostLoginTarget(
						searchParams.get("callbackUrl"),
					),
				});
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (error: any) {
			toast.danger(error?.message);
		}
	};

	return (
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
					: "Create Account"}
			</Button>
		</FormWrapper>
	);
}
