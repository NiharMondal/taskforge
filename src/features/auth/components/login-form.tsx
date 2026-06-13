"use client";

import { Button, toast } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { LoginInput, loginSchema } from "../schemas/auth-schema";
import { FormTextField, FormWrapper } from "@/components/form-element";
import { getApiErrorMessage } from "@/lib/api-error";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Where to land after a successful sign-in. The proxy puts the originally
 * requested URL (absolute, e.g. an `/invite/<token>` link) in `callbackUrl`;
 * honoring it only when same-origin prevents open redirects.
 */
function resolvePostLoginTarget(callbackUrl: string | null): string {
	if (!callbackUrl) return "/dashboard";
	try {
		const url = new URL(callbackUrl, window.location.origin);
		if (url.origin === window.location.origin) {
			return url.pathname + url.search;
		}
	} catch {
		// Malformed callbackUrl — fall through to the dashboard.
	}
	return "/dashboard";
}

export default function LoginForm() {
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
			if (res.code === "invalid_credentials") {
				toast.danger("Invalid Credentials");
			} else {
				toast.success("Logged in successfully");
				router.push(
					resolvePostLoginTarget(searchParams.get("callbackUrl")),
				);
			}
		} catch (error) {
			toast.danger(getApiErrorMessage(error || "Something went wrong"));
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
				type="password"
			/>
			<Button type="submit" className={"w-full"}>
				Login
			</Button>
		</FormWrapper>
	);
}
