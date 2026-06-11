"use client";

import { Button, toast } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { LoginInput, loginSchema } from "../schemas/auth-schema";
import { FormTextField, FormWrapper } from "@/components/form-element";
import { getApiErrorMessage } from "@/lib/api-error";
import { useRouter } from "next/navigation";

export default function LoginForm() {
	const router = useRouter();
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
				router.push("/dashboard");
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
