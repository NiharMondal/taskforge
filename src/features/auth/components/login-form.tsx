"use client";

import { FormTextField, FormWrapper } from "@/components/form-element";
import { getApiErrorMessage } from "@/lib/api-error";
import GoogleIcon from "@/shared/icons/google-icon";
import { Button, toast } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { LoginInput, loginSchema } from "../schemas/auth-schema";

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
				type={showPassword ? "text" : "password"}
				ornament={
					<div onClick={() => setShowPassword((prev) => !prev)}>
						{showPassword ? (
							<Eye size={20} />
						) : (
							<EyeOff size={20} />
						)}
					</div>
				}
			/>
			<div className="flex items-center gap-3 my-4">
				<div className="h-px flex-1 bg-muted/20" />
				<span className="text-xs text-default-400">OR</span>
				<div className="h-px flex-1 bg-muted/20" />
			</div>
			<Button
				type="button"
				className="w-full"
				variant="outline"
				onPress={() => signIn("google")}
			>
				<GoogleIcon />
				Continue with Google
			</Button>
			<Button type="submit" className={"w-full"}>
				Login
			</Button>
		</FormWrapper>
	);
}
