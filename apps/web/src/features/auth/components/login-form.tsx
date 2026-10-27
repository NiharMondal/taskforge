"use client";

import { FormTextField, FormWrapper } from "@/components/form-element";
import { getApiErrorMessage } from "@/lib/api-error";
import GoogleIcon from "@/shared/icons/google-icon";
import { Button, toast } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
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
			<div className="flex items-center gap-3 my-4">
				<div className="h-px flex-1 bg-muted/20" />
				<span className="text-xs text-muted">OR</span>
				<div className="h-px flex-1 bg-muted/20" />
			</div>
			<Button
				type="button"
				className="w-full"
				variant="outline"
				onPress={() =>
					signIn("google", {
						redirectTo: resolvePostLoginTarget(
							searchParams.get("callbackUrl"),
						),
					})
				}
			>
				<GoogleIcon />
				Continue with Google
			</Button>
			<Button
				type="submit"
				className={"w-full"}
				isDisabled={methods.formState.isSubmitting}
			>
				{methods.formState.isSubmitting ? "Signing in…" : "Login"}
			</Button>
		</FormWrapper>
	);
}
